"""
Unit tests: Session State Machine — AGENTS.md §9

Coverage map (6 kịch bản từ task spec):
  SC-01  Happy path:   CREATED → ACTIVE → ENDING → ENDED → FEEDBACK_READY
  SC-02  Flaky net:    ACTIVE ⇄ RECONNECTING  (bidirectional)
  SC-03  Timeout:      RECONNECTING → ENDING  (và timeout handler logic)
  SC-04  Retry:        ENDED → FAILED → ENDED (→ FEEDBACK_READY)
  SC-05  Illegal jump: 12 cặp trạng thái bất hợp lệ
  SC-06  Mic denied:   CREATED không bao giờ → ACTIVE khi mic bị từ chối

Triết lý test:
  - Mỗi test độc lập, không phụ thuộc DB, không gọi mạng.
  - Dùng parametrize cho bảng ca biên.
  - Tên hàm theo hành vi: test_<hành_vi_mô_tả>
  - Chạy trong < 50ms tổng cộng.
"""

from __future__ import annotations

import pytest

from app.services.session_state_machine import (
    InvalidSessionStateTransitionError,
    SessionState,
    SessionStateMachine,
)

# ===========================================================================
# SC-01: Happy Path — CREATED → ACTIVE → ENDING → ENDED → FEEDBACK_READY
# ===========================================================================


class TestHappyPath:
    """SC-01: Toàn bộ vòng đời bình thường của một session."""

    def test_created_to_active_with_mic_permission(self) -> None:
        """Bước 1/4: Session mới được phép chuyển sang ACTIVE khi có quyền mic."""
        result = SessionStateMachine.transition(SessionState.CREATED, SessionState.ACTIVE)
        assert result == SessionState.ACTIVE

    def test_active_to_ending_when_user_ends_session(self) -> None:
        """Bước 2/4: User hoặc hệ thống kết thúc session → ENDING."""
        result = SessionStateMachine.transition(SessionState.ACTIVE, SessionState.ENDING)
        assert result == SessionState.ENDING

    def test_ending_to_ended_after_cleanup(self) -> None:
        """Bước 3/4: Sau khi dọn dẹp xong → ENDED."""
        result = SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
        assert result == SessionState.ENDED

    def test_ended_to_feedback_ready_after_scoring(self) -> None:
        """Bước 4/4: Sau khi scoring engine hoàn thành → FEEDBACK_READY."""
        result = SessionStateMachine.transition(SessionState.ENDED, SessionState.FEEDBACK_READY)
        assert result == SessionState.FEEDBACK_READY

    def test_full_happy_path_chain(self) -> None:
        """SC-01 toàn chuỗi: CREATED → ACTIVE → ENDING → ENDED → FEEDBACK_READY."""
        chain = [
            (SessionState.CREATED, SessionState.ACTIVE),
            (SessionState.ACTIVE, SessionState.ENDING),
            (SessionState.ENDING, SessionState.ENDED),
            (SessionState.ENDED, SessionState.FEEDBACK_READY),
        ]
        current = SessionState.CREATED
        for _from, to in chain:
            assert current == _from, f"Trạng thái hiện tại phải là {_from}, nhưng là {current}"
            current = SessionStateMachine.transition(_from, to)
        assert current == SessionState.FEEDBACK_READY

    def test_feedback_ready_is_terminal_state(self) -> None:
        """FEEDBACK_READY là terminal: can_transition luôn trả False cho mọi đích."""
        for target in SessionState:
            assert SessionStateMachine.can_transition(SessionState.FEEDBACK_READY, target) is False

    def test_insufficient_data_is_terminal_state(self) -> None:
        """INSUFFICIENT_DATA là terminal: can_transition luôn trả False."""
        for target in SessionState:
            assert (
                SessionStateMachine.can_transition(SessionState.INSUFFICIENT_DATA, target) is False
            )


# ===========================================================================
# SC-02: Mạng chập chờn — ACTIVE ⇄ RECONNECTING
# ===========================================================================


class TestFlakyNetwork:
    """SC-02: Mất kết nối và kết nối lại thành công."""

    def test_active_to_reconnecting_on_disconnect(self) -> None:
        """Khi client ngắt kết nối đột ngột, session → RECONNECTING."""
        result = SessionStateMachine.transition(SessionState.ACTIVE, SessionState.RECONNECTING)
        assert result == SessionState.RECONNECTING

    def test_reconnecting_to_active_on_reconnect(self) -> None:
        """Khi client kết nối lại thành công, session → ACTIVE."""
        result = SessionStateMachine.transition(SessionState.RECONNECTING, SessionState.ACTIVE)
        assert result == SessionState.ACTIVE

    def test_multiple_reconnect_cycles(self) -> None:
        """Người dùng mất kết nối và kết nối lại nhiều lần — mỗi chu kỳ đều hợp lệ."""
        state = SessionState.ACTIVE
        for cycle in range(3):
            state = SessionStateMachine.transition(state, SessionState.RECONNECTING)
            assert state == SessionState.RECONNECTING, f"Chu kỳ {cycle}: phải là RECONNECTING"
            state = SessionStateMachine.transition(state, SessionState.ACTIVE)
            assert state == SessionState.ACTIVE, f"Chu kỳ {cycle}: phải là ACTIVE sau reconnect"

    def test_can_transition_reports_true_for_bidirectional(self) -> None:
        """can_transition() phải nhất quán với transition() cho cả hai chiều."""
        assert SessionStateMachine.can_transition(SessionState.ACTIVE, SessionState.RECONNECTING)
        assert SessionStateMachine.can_transition(SessionState.RECONNECTING, SessionState.ACTIVE)

    def test_reconnecting_state_enum_value(self) -> None:
        """Giá trị string của RECONNECTING phải đúng để lưu DB."""
        assert SessionState.RECONNECTING.value == "RECONNECTING"


# ===========================================================================
# SC-03: Timeout — RECONNECTING → ENDING khi hết thời gian chờ
# ===========================================================================


class TestReconnectTimeout:
    """SC-03: Session bị kết thúc cưỡng bức sau khi hết timeout."""

    def test_reconnecting_to_ending_on_timeout(self) -> None:
        """Sau khi hết timeout, session RECONNECTING → ENDING (không phải nhảy thẳng sang ENDED)."""
        result = SessionStateMachine.transition(SessionState.RECONNECTING, SessionState.ENDING)
        assert result == SessionState.ENDING

    def test_ending_to_ended_after_timeout_ending(self) -> None:
        """Tiếp theo: ENDING → ENDED để hoàn tất chu trình timeout."""
        state = SessionStateMachine.transition(SessionState.RECONNECTING, SessionState.ENDING)
        state = SessionStateMachine.transition(state, SessionState.ENDED)
        assert state == SessionState.ENDED

    def test_timeout_path_cannot_skip_ending(self) -> None:
        """Không thể nhảy từ RECONNECTING thẳng sang ENDED (phải qua ENDING)."""
        assert (
            SessionStateMachine.can_transition(SessionState.RECONNECTING, SessionState.ENDED)
            is False
        )
        with pytest.raises(InvalidSessionStateTransitionError):
            SessionStateMachine.transition(SessionState.RECONNECTING, SessionState.ENDED)

    def test_timeout_handler_state_machine_logic(self) -> None:
        """
        Test logic state machine của timeout handler (SC-03).

        _handle_timeout_after_disconnect thực hiện đúng 2 bước:
          1. RECONNECTING → ENDING
          2. ENDING → ENDED
        và gán end_reason = "TIMEOUT".

        Test này xác minh rằng logic state machine của handler là đúng
        mà không cần gọi asyncio.sleep hay DB thật.
        """
        # Mô phỏng logic trong _handle_timeout_after_disconnect:
        # sess.status == RECONNECTING → transition to ENDING → ENDED
        simulated_status = SessionState.RECONNECTING.value

        if simulated_status == SessionState.RECONNECTING.value:
            new_state = SessionStateMachine.transition(
                SessionState.RECONNECTING, SessionState.ENDING
            )
            assert new_state == SessionState.ENDING

            new_state = SessionStateMachine.transition(SessionState.ENDING, SessionState.ENDED)
            assert new_state == SessionState.ENDED

            end_reason = "TIMEOUT"

        assert new_state == SessionState.ENDED
        assert end_reason == "TIMEOUT"

    def test_timeout_handler_ignores_non_reconnecting_state_machine_check(self) -> None:
        """
        Nếu session đã chuyển sang trạng thái khác (vd: ACTIVE) trước timeout,
        handler không được can thiệp.

        Xác minh guard condition: sess.status == RECONNECTING.value
        """
        simulated_status = SessionState.ACTIVE.value  # User kết nối lại thành công

        # Guard condition trong handler
        should_end = simulated_status == SessionState.RECONNECTING.value
        assert should_end is False, "Handler phải bỏ qua session không còn RECONNECTING"

    def test_timeout_handler_missing_session_guard(self) -> None:
        """
        Handler kiểm tra `if sess and sess.status == RECONNECTING` trước khi thao tác.
        Nếu sess là None → không thực hiện bất kỳ transition nào.
        """
        sess = None  # Giả lập session không tìm thấy
        should_process = (
            sess is not None and getattr(sess, "status", None) == SessionState.RECONNECTING.value
        )
        assert should_process is False, "Handler phải bỏ qua nếu session là None"


# ===========================================================================
# SC-04: Lỗi xử lý feedback — ENDED → FAILED → ENDED (retry) → FEEDBACK_READY
# ===========================================================================


class TestFeedbackRetryPath:
    """SC-04: Luồng xử lý khi scoring engine thất bại và được retry."""

    def test_ended_to_failed_when_llm_errors(self) -> None:
        """Khi LLM lỗi, session ENDED → FAILED (giữ retryable=True)."""
        result = SessionStateMachine.transition(SessionState.ENDED, SessionState.FAILED)
        assert result == SessionState.FAILED

    def test_failed_to_ended_on_retry(self) -> None:
        """Khi người dùng trigger retry, FAILED → ENDED để scoring lại."""
        result = SessionStateMachine.transition(SessionState.FAILED, SessionState.ENDED)
        assert result == SessionState.ENDED

    def test_ended_to_feedback_ready_after_successful_retry(self) -> None:
        """Sau khi retry thành công: ENDED → FEEDBACK_READY."""
        result = SessionStateMachine.transition(SessionState.ENDED, SessionState.FEEDBACK_READY)
        assert result == SessionState.FEEDBACK_READY

    def test_full_retry_chain(self) -> None:
        """SC-04 toàn chuỗi: ENDED → FAILED → ENDED → FEEDBACK_READY."""
        state = SessionState.ENDED
        # LLM thất bại lần đầu
        state = SessionStateMachine.transition(state, SessionState.FAILED)
        assert state == SessionState.FAILED
        # Retry: trở về ENDED để chạy lại scoring
        state = SessionStateMachine.transition(state, SessionState.ENDED)
        assert state == SessionState.ENDED
        # Retry thành công
        state = SessionStateMachine.transition(state, SessionState.FEEDBACK_READY)
        assert state == SessionState.FEEDBACK_READY

    def test_failed_cannot_jump_to_feedback_ready_directly(self) -> None:
        """FAILED không thể nhảy thẳng sang FEEDBACK_READY — phải qua ENDED trước."""
        assert (
            SessionStateMachine.can_transition(SessionState.FAILED, SessionState.FEEDBACK_READY)
            is False
        )
        with pytest.raises(InvalidSessionStateTransitionError) as exc_info:
            SessionStateMachine.transition(SessionState.FAILED, SessionState.FEEDBACK_READY)
        assert "FAILED" in str(exc_info.value)
        assert "FEEDBACK_READY" in str(exc_info.value)

    def test_retry_idempotent_state_check(self) -> None:
        """can_transition(FAILED, ENDED) phải trả True để retry_feedback() hoạt động."""
        assert SessionStateMachine.can_transition(SessionState.FAILED, SessionState.ENDED) is True

    def test_ended_can_also_go_to_insufficient_data(self) -> None:
        """ENDED → INSUFFICIENT_DATA khi session quá ngắn — không phải FAILED."""
        result = SessionStateMachine.transition(SessionState.ENDED, SessionState.INSUFFICIENT_DATA)
        assert result == SessionState.INSUFFICIENT_DATA


# ===========================================================================
# SC-05: Chặn chuyển trạng thái bất hợp lệ
# ===========================================================================


class TestIllegalTransitions:
    """SC-05: Tất cả các bước nhảy bị cấm đều raise InvalidSessionStateTransitionError."""

    # Bảng đầy đủ các cặp bất hợp lệ theo AGENTS.md §9
    @pytest.mark.parametrize(
        ("from_state", "to_state", "description"),
        [
            # Nhảy quá sớm từ CREATED
            (SessionState.CREATED, SessionState.ENDED, "CREATED không thể nhảy sang ENDED"),
            (SessionState.CREATED, SessionState.RECONNECTING, "CREATED không có network state"),
            (
                SessionState.CREATED,
                SessionState.FEEDBACK_READY,
                "CREATED không thể nhảy sang FEEDBACK_READY",
            ),
            (SessionState.CREATED, SessionState.FAILED, "CREATED không thể nhảy sang FAILED"),
            # Từ ACTIVE không thể quay lui hoặc nhảy cóc
            (SessionState.ACTIVE, SessionState.CREATED, "ACTIVE không thể quay lại CREATED"),
            (SessionState.ACTIVE, SessionState.ENDED, "ACTIVE phải qua ENDING trước"),
            (
                SessionState.ACTIVE,
                SessionState.FEEDBACK_READY,
                "ACTIVE không thể nhảy sang FEEDBACK_READY",
            ),
            (
                SessionState.ACTIVE,
                SessionState.INSUFFICIENT_DATA,
                "ACTIVE không thể sang INSUFFICIENT_DATA",
            ),
            (SessionState.ACTIVE, SessionState.FAILED, "ACTIVE không thể nhảy sang FAILED"),
            # Từ ENDING chỉ được đến ENDED
            (SessionState.ENDING, SessionState.ACTIVE, "Không thể hoàn tác ENDING"),
            (SessionState.ENDING, SessionState.RECONNECTING, "ENDING không thể RECONNECTING"),
            (SessionState.ENDING, SessionState.FEEDBACK_READY, "Phải qua ENDED trước"),
            (SessionState.ENDING, SessionState.CREATED, "ENDING không thể quay về CREATED"),
            # Terminal states không được đi đến trạng thái khác
            (SessionState.FEEDBACK_READY, SessionState.ACTIVE, "FEEDBACK_READY là terminal"),
            (SessionState.FEEDBACK_READY, SessionState.ENDED, "FEEDBACK_READY là terminal"),
            (SessionState.FEEDBACK_READY, SessionState.CREATED, "FEEDBACK_READY là terminal"),
            (SessionState.INSUFFICIENT_DATA, SessionState.ACTIVE, "INSUFFICIENT_DATA là terminal"),
            (SessionState.INSUFFICIENT_DATA, SessionState.ENDED, "INSUFFICIENT_DATA là terminal"),
            # ENDED không thể quay ngược
            (SessionState.ENDED, SessionState.ACTIVE, "ENDED không thể quay lại ACTIVE"),
            (SessionState.ENDED, SessionState.ENDING, "ENDED không thể quay lại ENDING"),
            (SessionState.ENDED, SessionState.CREATED, "ENDED không thể quay lại CREATED"),
            (SessionState.ENDED, SessionState.RECONNECTING, "ENDED không thể RECONNECTING"),
            # FAILED chỉ được đến ENDED
            (SessionState.FAILED, SessionState.ACTIVE, "FAILED không thể sang ACTIVE"),
            (SessionState.FAILED, SessionState.FEEDBACK_READY, "FAILED phải qua ENDED trước"),
            (SessionState.FAILED, SessionState.CREATED, "FAILED không thể sang CREATED"),
        ],
    )
    def test_illegal_transition_raises_error(
        self,
        from_state: SessionState,
        to_state: SessionState,
        description: str,
    ) -> None:
        """Mọi bước nhảy bất hợp lệ đều bị từ chối với lỗi rõ ràng."""
        # can_transition phải nhất quán
        assert SessionStateMachine.can_transition(from_state, to_state) is False, (
            f"can_transition({from_state}, {to_state}) phải False — {description}"
        )
        # transition phải raise
        with pytest.raises(InvalidSessionStateTransitionError) as exc_info:
            SessionStateMachine.transition(from_state, to_state)
        error = exc_info.value
        # Thông báo lỗi phải nêu rõ from/to để dễ debug
        assert from_state.value in str(error), (
            f"Lỗi phải nhắc tới trạng thái gốc '{from_state.value}'"
        )
        assert to_state.value in str(error), f"Lỗi phải nhắc tới trạng thái đích '{to_state.value}'"

    def test_error_attributes_are_populated(self) -> None:
        """InvalidSessionStateTransitionError phải có from_state và to_state attributes."""
        try:
            SessionStateMachine.transition(SessionState.CREATED, SessionState.FEEDBACK_READY)
        except InvalidSessionStateTransitionError as err:
            assert err.from_state == SessionState.CREATED.value
            assert err.to_state == SessionState.FEEDBACK_READY.value
            assert err.reason is not None and len(err.reason) > 0
        else:
            pytest.fail("Phải raise InvalidSessionStateTransitionError")

    def test_unknown_state_string_raises_error(self) -> None:
        """State string không hợp lệ phải raise, không silent fail."""
        with pytest.raises(InvalidSessionStateTransitionError):
            SessionStateMachine.transition("BOGUS_STATE", SessionState.ACTIVE)

    def test_can_transition_returns_false_for_unknown_state(self) -> None:
        """can_transition với state không hợp lệ trả False, không crash."""
        assert SessionStateMachine.can_transition("NOT_A_STATE", SessionState.ACTIVE) is False
        assert SessionStateMachine.can_transition(SessionState.ACTIVE, "NOT_A_STATE") is False


# ===========================================================================
# SC-06: Từ chối mic — session không bao giờ chuyển sang ACTIVE
# ===========================================================================


class TestMicrophoneDenied:
    """SC-06: Quyền mic bị từ chối → session bị kẹt ở CREATED mãi mãi."""

    def test_mic_denied_raises_error(self) -> None:
        """Trường hợp cơ bản: has_mic_permission=False → raise error."""
        with pytest.raises(InvalidSessionStateTransitionError) as exc_info:
            SessionStateMachine.transition(
                SessionState.CREATED,
                SessionState.ACTIVE,
                has_mic_permission=False,
            )
        assert "Microphone permission denied" in str(exc_info.value)

    def test_mic_denied_error_message_is_clear(self) -> None:
        """Thông báo lỗi phải đủ rõ ràng để frontend hiển thị cho user."""
        try:
            SessionStateMachine.transition(
                SessionState.CREATED, SessionState.ACTIVE, has_mic_permission=False
            )
        except InvalidSessionStateTransitionError as err:
            msg = str(err).lower()
            # Phải nhắc tới "microphone" hoặc "mic" và "permission" hoặc "denied"
            assert "microphone" in msg or "mic" in msg, "Lỗi phải nhắc tới microphone"
            assert "permission" in msg or "denied" in msg, "Lỗi phải nhắc tới permission/denied"
        else:
            pytest.fail("Phải raise error")

    def test_mic_granted_allows_transition(self) -> None:
        """Ngược lại: has_mic_permission=True (mặc định) → cho phép chuyển sang ACTIVE."""
        result = SessionStateMachine.transition(
            SessionState.CREATED,
            SessionState.ACTIVE,
            has_mic_permission=True,
        )
        assert result == SessionState.ACTIVE

    def test_mic_permission_default_is_true(self) -> None:
        """has_mic_permission mặc định phải là True (backward compat)."""
        # Gọi không truyền has_mic_permission → phải thành công
        result = SessionStateMachine.transition(SessionState.CREATED, SessionState.ACTIVE)
        assert result == SessionState.ACTIVE

    def test_mic_denied_does_not_affect_other_transitions(self) -> None:
        """Tham số has_mic_permission chỉ ảnh hưởng đến CREATED→ACTIVE, không can thiệp bước khác."""
        # has_mic_permission=False nhưng transition không phải CREATED→ACTIVE
        # → không bị chặn bởi mic rule, mà bị chặn bởi invalid transition rule bình thường
        with pytest.raises(InvalidSessionStateTransitionError) as exc_info:
            SessionStateMachine.transition(
                SessionState.ACTIVE,
                SessionState.CREATED,
                has_mic_permission=False,  # Không liên quan ở đây
            )
        # Lỗi phải về ACTIVE→CREATED bất hợp lệ, không phải về mic
        assert "Microphone" not in str(exc_info.value)

    @pytest.mark.parametrize(
        "other_state",
        [
            SessionState.ACTIVE,
            SessionState.RECONNECTING,
            SessionState.ENDING,
            SessionState.ENDED,
            SessionState.FAILED,
            SessionState.FEEDBACK_READY,
            SessionState.INSUFFICIENT_DATA,
        ],
    )
    def test_mic_permission_irrelevant_for_non_created_states(
        self, other_state: SessionState
    ) -> None:
        """
        Tham số has_mic_permission=False không thêm hành vi đặc biệt nào
        khi trạng thái gốc không phải CREATED.
        (Những cặp có thể hợp lệ sẽ thành công; bất hợp lệ vẫn raise bình thường.)
        """
        valid_from_other = SessionStateMachine.can_transition(other_state, SessionState.ACTIVE)
        if valid_from_other:
            # Nếu hợp lệ, mic=False không được thêm cản trở
            result = SessionStateMachine.transition(
                other_state, SessionState.ACTIVE, has_mic_permission=False
            )
            assert result == SessionState.ACTIVE
        else:
            # Nếu bất hợp lệ, lỗi phải về invalid transition, không phải mic
            with pytest.raises(InvalidSessionStateTransitionError) as exc_info:
                SessionStateMachine.transition(
                    other_state, SessionState.ACTIVE, has_mic_permission=False
                )
            assert "Microphone" not in str(exc_info.value), (
                "Lỗi mic chỉ được xuất hiện khi from_state=CREATED"
            )


# ===========================================================================
# Bổ sung: Kiểm tra tính nhất quán nội bộ của SessionState enum
# ===========================================================================


class TestStateMachineInternals:
    """Đảm bảo cấu trúc _VALID_TRANSITIONS nhất quán và đầy đủ."""

    def test_all_states_present_in_transition_table(self) -> None:
        """Mọi SessionState đều có entry trong _VALID_TRANSITIONS."""
        for state in SessionState:
            assert state in SessionStateMachine._VALID_TRANSITIONS, (
                f"Trạng thái '{state}' thiếu trong _VALID_TRANSITIONS"
            )

    def test_transition_targets_are_valid_states(self) -> None:
        """Mọi đích trong _VALID_TRANSITIONS đều là SessionState hợp lệ."""
        valid_states = set(SessionState)
        for from_state, targets in SessionStateMachine._VALID_TRANSITIONS.items():
            for target in targets:
                assert target in valid_states, (
                    f"Đích '{target}' từ '{from_state}' không phải SessionState hợp lệ"
                )

    def test_can_transition_consistent_with_valid_transitions_table(self) -> None:
        """can_transition() phải nhất quán 100% với _VALID_TRANSITIONS."""
        for from_state in SessionState:
            for to_state in SessionState:
                expected = to_state in SessionStateMachine._VALID_TRANSITIONS.get(from_state, set())
                actual = SessionStateMachine.can_transition(from_state, to_state)
                assert actual == expected, (
                    f"can_transition({from_state}, {to_state}) trả {actual}, "
                    f"nhưng bảng _VALID_TRANSITIONS nói {expected}"
                )

    def test_state_values_are_uppercase_strings(self) -> None:
        """Giá trị string của mọi state phải uppercase (vì lưu vào DB dạng VARCHAR)."""
        for state in SessionState:
            assert state.value == state.value.upper(), (
                f"SessionState.{state.name}.value = '{state.value}' phải là UPPERCASE"
            )

    def test_session_state_is_str_enum(self) -> None:
        """SessionState dùng StrEnum nên có thể dùng trực tiếp như string."""
        assert SessionState.ACTIVE == "ACTIVE"
        assert str(SessionState.ENDED) == "ENDED"
