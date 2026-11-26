export const skillLabels: Record<string, string> = {
  fluency: 'Độ lưu loát',
  listening: 'Nghe hiểu',
  vocabulary: 'Từ vựng theo ngữ cảnh',
  response_speed: 'Tốc độ phản hồi',
  pronunciation: 'Phát âm',
};

export const sessionStatuses: Record<string, string> = {
  CREATED: 'Đã tạo',
  ACTIVE: 'Đang luyện',
  RECONNECTING: 'Đang kết nối lại',
  ENDING: 'Đang kết thúc',
  ENDED: 'Đã kết thúc',
  PENDING: 'Đang chấm',
  FEEDBACK_READY: 'Có phản hồi',
  INSUFFICIENT_DATA: 'Thiếu dữ liệu',
  FAILED: 'Thất bại',
  NOT_REQUESTED: 'Chưa có bản ghi',
};

export const qaLabels = [
  { value: 'STT', name: 'Lỗi nhận dạng giọng nói' },
  { value: 'AI_RESPONSE', name: 'Phản hồi AI' },
  { value: 'SCORING', name: 'Lỗi chấm điểm' },
  { value: 'UNUSUAL_SCORE', name: 'Điểm bất thường' },
] as const;
