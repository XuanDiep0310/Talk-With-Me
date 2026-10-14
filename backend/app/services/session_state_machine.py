"""
Session State Machine implementation according to AGENTS.md §9.

States:
  CREATED, ACTIVE, RECONNECTING, ENDING, ENDED,
  FEEDBACK_READY, INSUFFICIENT_DATA, FAILED.

Allowed transitions:
  CREATED       -> ACTIVE
  ACTIVE        <-> RECONNECTING
  ACTIVE        -> ENDING
  RECONNECTING  -> ENDING (timeout or explicit end)
  ENDING        -> ENDED
  ENDED         -> FEEDBACK_READY | INSUFFICIENT_DATA | FAILED
  FAILED        -> ENDED (on retry)

All other transitions are strictly rejected.
Microphone permission denial prevents CREATED from transitioning to ACTIVE.
"""

from enum import StrEnum


class SessionState(StrEnum):
    CREATED = "CREATED"
    ACTIVE = "ACTIVE"
    RECONNECTING = "RECONNECTING"
    ENDING = "ENDING"
    ENDED = "ENDED"
    FEEDBACK_READY = "FEEDBACK_READY"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    FAILED = "FAILED"


class SessionType(StrEnum):
    COACH = "COACH"
    ROLEPLAY = "ROLEPLAY"
    ROOM = "ROOM"


class InvalidSessionStateTransitionError(Exception):
    """Raised when an invalid state transition is attempted on a session."""

    def __init__(self, from_state: str, to_state: str, reason: str | None = None) -> None:
        self.from_state = from_state
        self.to_state = to_state
        self.reason = reason or f"Cannot transition session from '{from_state}' to '{to_state}'"
        super().__init__(self.reason)


class SessionStateMachine:
    """Encapsulates session lifecycle transitions and validation."""

    _VALID_TRANSITIONS: dict[SessionState, set[SessionState]] = {
        SessionState.CREATED: {SessionState.ACTIVE},
        SessionState.ACTIVE: {SessionState.RECONNECTING, SessionState.ENDING},
        SessionState.RECONNECTING: {SessionState.ACTIVE, SessionState.ENDING},
        SessionState.ENDING: {SessionState.ENDED},
        SessionState.ENDED: {
            SessionState.FEEDBACK_READY,
            SessionState.INSUFFICIENT_DATA,
            SessionState.FAILED,
        },
        SessionState.FAILED: {SessionState.ENDED},
        SessionState.FEEDBACK_READY: set(),
        SessionState.INSUFFICIENT_DATA: set(),
    }

    @classmethod
    def can_transition(cls, from_state: str | SessionState, to_state: str | SessionState) -> bool:
        """Check if transition from from_state to to_state is valid."""
        try:
            source = SessionState(from_state)
            target = SessionState(to_state)
        except ValueError:
            return False

        allowed_targets = cls._VALID_TRANSITIONS.get(source, set())
        return target in allowed_targets

    @classmethod
    def transition(
        cls,
        current_state: str | SessionState,
        target_state: str | SessionState,
        has_mic_permission: bool = True,
    ) -> SessionState:
        """
        Transition session to target_state.
        Raises InvalidSessionStateTransitionError if transition is prohibited.
        """
        try:
            source = SessionState(current_state)
            target = SessionState(target_state)
        except ValueError as err:
            raise InvalidSessionStateTransitionError(
                str(current_state),
                str(target_state),
                f"Unknown session state: {err}",
            ) from err

        # Specific rule: microphone permission denial prevents moving to ACTIVE
        if (
            source == SessionState.CREATED
            and target == SessionState.ACTIVE
            and not has_mic_permission
        ):
            raise InvalidSessionStateTransitionError(
                source.value,
                target.value,
                "Microphone permission denied: session cannot transition to ACTIVE",
            )

        allowed_targets = cls._VALID_TRANSITIONS.get(source, set())
        if target not in allowed_targets:
            raise InvalidSessionStateTransitionError(source.value, target.value)

        return target
