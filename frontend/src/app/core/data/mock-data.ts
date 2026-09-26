import type { Achievement, AiCoachSkillMetric, AiCoachTopicGroup, CommunityRoomMember, ConversationLine, DashboardShortcut, DashboardSkill, FaqItem, LevelRequirement, LoginFeature, Mission, ProgressSessionHistory, QuickGuide, RecommendedExercise, RoomListing, Scenario, ScenarioChunk, ScenarioGroup, ScenarioTaskResult, Session, Settings, SkillProgress, SummaryMetric, ThemeOption, UsefulPhrase, User, XpHistoryEntry } from '../models/app.models';

export const MOCK_USER: User = {
  name: "Minh Anh",
  email: "minhanh@gmail.com",
  level: "B1",
  xp: 3420,
  streak: 12,
  avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=80&h=80&fit=crop&auto=format",
  interests: ["Du lịch", "Công nghệ", "Ẩm thực"],
  goals: ["Giao tiếp tự nhiên", "Thuyết trình công việc"],
  weaknesses: ["Phát âm", "Tốc độ phản hồi"],
};

export const MOCK_RECENT_SESSIONS: Session[] = [
  { topic: "Giới thiệu bản thân", date: "Hôm nay, 09:15", duration: "18 phút", score: 76, type: "ai-coach" },
  { topic: "Đặt phòng khách sạn", date: "Hôm qua, 20:30", duration: "12 phút", score: 82, type: "scenario" },
  { topic: "Small Talk at Work", date: "2 ngày trước", duration: "25 phút", score: 70, type: "community" }
];
export const GROUPS: ScenarioGroup[] = [
  {
    id: "daily",
    label: "Đời sống hằng ngày",
    emoji: "☀️",
    scenarios: [
      { id: 1, title: "Mua sắm tại siêu thị", desc: "Hỏi giá, tìm sản phẩm, thanh toán", level: "A2", duration: "10 phút", emoji: "🛒", done: true, xp: 30 },
      { id: 2, title: "Đặt bàn tại nhà hàng", desc: "Đặt bàn qua điện thoại, chọn món", level: "A2", duration: "12 phút", emoji: "🍽️", done: false, xp: 30 },
      { id: 3, title: "Đến gặp bác sĩ", desc: "Mô tả triệu chứng, hỏi đơn thuốc", level: "B1", duration: "15 phút", emoji: "🏥", done: false, xp: 40 },
      { id: 4, title: "Thuê căn hộ", desc: "Hỏi giá thuê, tiện ích, điều kiện", level: "B1", duration: "15 phút", emoji: "🏠", done: true, xp: 40 }
    ]
  },
  {
    id: "social",
    label: "Giao tiếp xã hội",
    emoji: "🤝",
    scenarios: [
      { id: 5, title: "Giới thiệu bản thân", desc: "Gặp gỡ người mới, kể về bản thân", level: "A2", duration: "10 phút", emoji: "👋", done: true, xp: 25 },
      { id: 6, title: "Tiệc gặp mặt (Party)", desc: "Tham gia hội thoại nhóm, small talk", level: "B1", duration: "20 phút", emoji: "🎉", done: false, xp: 45 },
      { id: 7, title: "Kết bạn online", desc: "Chat video, tìm điểm chung", level: "B1", duration: "15 phút", emoji: "💬", done: false, xp: 35 }
    ]
  },
  {
    id: "travel",
    label: "Du lịch & Mua sắm",
    emoji: "✈️",
    scenarios: [
      { id: 8, title: "Check-in khách sạn", desc: "Đặt phòng, yêu cầu dịch vụ", level: "A2", duration: "12 phút", emoji: "🏨", done: false, xp: 30 },
      { id: 9, title: "Hỏi đường & Di chuyển", desc: "Hỏi đường, dùng phương tiện công cộng", level: "A2", duration: "10 phút", emoji: "🗺️", done: false, xp: 25 },
      { id: 10, title: "Mua sắm tại trung tâm", desc: "Hỏi size, màu, mặc cả", level: "B1", duration: "15 phút", emoji: "👗", done: false, xp: 35 },
      { id: 11, title: "Tham quan bảo tàng", desc: "Hỏi thông tin, giải thích văn hóa", level: "B2", duration: "20 phút", emoji: "🏛️", done: false, xp: 50 }
    ]
  },
  {
    id: "work",
    label: "Nơi làm việc",
    emoji: "💼",
    scenarios: [
      { id: 12, title: "Phỏng vấn xin việc", desc: "Trả lời câu hỏi HR, giới thiệu kinh nghiệm", level: "B1", duration: "20 phút", emoji: "🤝", done: false, xp: 60 },
      { id: 13, title: "Họp nhóm dự án", desc: "Trình bày tiến độ, đặt câu hỏi", level: "B2", duration: "25 phút", emoji: "📊", done: false, xp: 60 },
      { id: 14, title: "Gọi điện khách hàng", desc: "Giải quyết khiếu nại, đề xuất giải pháp", level: "B2", duration: "20 phút", emoji: "📞", done: false, xp: 55 },
      { id: 15, title: "Email & Báo cáo", desc: "Soạn email chuyên nghiệp, tóm tắt report", level: "C1", duration: "25 phút", emoji: "📧", done: false, xp: 70 }
    ]
  }
];

export const ROOMS: RoomListing[] = [
  { id: 1, title: "Kể chuyện cuối tuần", topic: "Daily Talk", level: "B1", members: 3, max: 5, active: true, emoji: "🌟", host: "Lan", duration: "12 phút" },
  { id: 2, title: "Work & Career Chat", topic: "Công việc", level: "B2", members: 4, max: 5, active: true, emoji: "💼", host: "Minh", duration: "8 phút" },
  { id: 3, title: "Du lịch mơ ước", topic: "Du lịch", level: "A2", members: 2, max: 5, active: true, emoji: "✈️", host: "Hoa", duration: "5 phút" },
  { id: 4, title: "Phim & Series TV", topic: "Giải trí", level: "B1", members: 5, max: 5, active: false, emoji: "🎬", host: "Tuấn", duration: "20 phút" },
  { id: 5, title: "Startup & Innovation", topic: "Kinh doanh", level: "B2", members: 3, max: 5, active: true, emoji: "🚀", host: "Nam", duration: "3 phút" },
  { id: 6, title: "Book Club - This week", topic: "Sách", level: "C1", members: 2, max: 4, active: true, emoji: "📚", host: "An", duration: "15 phút" }
];
export const MOCK_SCENARIO_DETAILS: Pick<Scenario, 'category' | 'objectives' | 'vocabulary' | 'image'> = {
  category: "Đời sống",
  objectives: ["Hoàn thành cuộc hội thoại thực tế", "Dùng từ vựng đúng ngữ cảnh"],
  vocabulary: [{ word: "Reservation", meaning: "Đặt chỗ trước" }],
  image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=200&fit=crop"
};

export const MOCK_ROOM_HOST_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop";


export const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: 1, emoji: "🎙️", name: "Người nói đầu tiên", desc: "Hoàn thành buổi AI Coach đầu tiên", earned: true, date: "12/01/2025" },
  { id: 2, emoji: "🔥", name: "Streak 7 ngày", desc: "Học liên tục 7 ngày", earned: true, date: "08/03/2025" },
  { id: 3, emoji: "🌟", name: "B1 Achiever", desc: "Đạt level B1", earned: true, date: "15/03/2025" },
  { id: 4, emoji: "🏆", name: "Fluency Master", desc: "Đạt điểm Fluency ≥ 80", earned: false, progress: 72, total: 80 },
  { id: 5, emoji: "🎭", name: "Diễn viên xuất sắc", desc: "Hoàn thành 20 tình huống roleplay", earned: false, progress: 7, total: 20 },
  { id: 6, emoji: "👥", name: "Ngôi sao cộng đồng", desc: "Tham gia 10 Voice Room", earned: false, progress: 3, total: 10 },
  { id: 7, emoji: "🔥", name: "Streak 30 ngày", desc: "Học liên tục 30 ngày", earned: false, progress: 12, total: 30 },
  { id: 8, emoji: "📚", name: "Từ điển sống", desc: "Học 500 từ vựng mới", earned: false, progress: 210, total: 500 },
  { id: 9, emoji: "⚡", name: "Tốc độ ánh sáng", desc: "Đạt điểm Tốc độ P.H ≥ 80", earned: false, progress: 55, total: 80 }
];

export const MOCK_DAILY_MISSIONS: Mission[] = [
  { id: 1, label: "Hoàn thành 1 buổi AI Coach", xp: 50, done: true, icon: "🎙️" },
  { id: 2, label: "Luyện 1 tình huống mới", xp: 30, done: false, icon: "🎭" },
  { id: 3, label: "Tham gia Phòng cộng đồng", xp: 40, done: false, icon: "👥" },
  { id: 4, label: "Duy trì streak hôm nay", xp: 20, done: true, icon: "🔥" }
];

export const MOCK_XP_HISTORY: XpHistoryEntry[] = [
  { date: "Hôm nay", xp: 70, source: "AI Coach + Streak" },
  { date: "Hôm qua", xp: 120, source: "Tình huống + AI Coach" },
  { date: "2 ngày trước", xp: 90, source: "Voice Room + AI Coach" },
  { date: "3 ngày trước", xp: 50, source: "AI Coach" },
  { date: "4 ngày trước", xp: 140, source: "Tình huống + Badge" }
];

export const THEME_OPTIONS: ThemeOption[] = [
    { val: "light", label: "☀️ Sáng" },
    { val: "dark", label: "🌙 Tối" },
    { val: "system", label: "💻 Hệ thống" }
  ];

export const MOCK_SETTINGS: Settings = {
  notifications: true,
  dailyReminder: true,
  aiVoice: "female",
  aiSpeed: "normal",
  theme: "light"
};


export const MOCK_AI_COACH_LINES: ConversationLine[] = [
  { id: 1, speaker: "AI", text: "Hello! Great to have you here today. Let's talk about travel. What's a place you've always wanted to visit?", translation: "Xin chào! Hôm nay chúng ta hãy nói về du lịch. Có nơi nào bạn luôn muốn đến không?", time: "00:05", final: true },
  { id: 2, speaker: "Bạn", text: "I would really love to visit Japan someday. I'm fascinated by the culture.", translation: "", time: "00:22", final: true },
  { id: 3, speaker: "AI", text: "Japan is a wonderful choice! What specifically draws you to Japanese culture?", translation: "Nhật Bản là lựa chọn tuyệt vời! Điều gì trong văn hóa Nhật Bản thu hút bạn?", time: "00:35", final: true },
  { id: 4, speaker: "Bạn", text: "I love the food, especially sushi and ramen. And the temples are beautiful.", translation: "", time: "00:55", final: true }
];

export const MOCK_USEFUL_PHRASES: UsefulPhrase[] = [
  { en: "I've always wanted to...", vi: "Tôi luôn muốn..." },
  { en: "What I find fascinating is...", vi: "Điều tôi thấy thú vị là..." },
  { en: "Could you say that again?", vi: "Bạn có thể nhắc lại không?" }
];

export const MOCK_COMMUNITY_MEMBERS: CommunityRoomMember[] = [
  { name: "Bạn", emoji: "👤", color: "#286FB4", speaking: false },
  { name: "Lan", emoji: "👩", color: "#DF4C73", speaking: false },
  { name: "Minh", emoji: "👨", color: "#7c3aed", speaking: false },
  { name: "Hoa", emoji: "🧑", color: "#059669", speaking: false }
];

export const MOCK_COMMUNITY_TRANSCRIPT: ConversationLine[] = [
  { id: 1, speaker: "Lan", text: "So, what did everyone do this weekend? I went hiking near the city!", time: "00:03" },
  { id: 2, speaker: "Minh", text: "That sounds amazing! I stayed home and binged a Netflix series. Total couch potato mode.", time: "00:18" },
  { id: 3, speaker: "Hoa", text: "I tried a new coffee shop downtown. The vibes were so good!", time: "00:35" }
];

export const MOCK_COMMUNITY_USER_UTTERANCE: Pick<ConversationLine, 'speaker' | 'text' | 'time'> = {
  speaker: "Báº¡n",
  text: "I totally agree! I spent my weekend reading a great book.",
  time: "01:12"
};

export const MOCK_AI_INTERIM_UTTERANCE = "I would really love to visit Japan...";

export const MOCK_ROLEPLAY_SCRIPT: ConversationLine[] = [
  { id: 1, speaker: "AI", text: "Good evening! Welcome to The Garden Restaurant. Do you have a reservation?", translation: "Chào buổi tối! Chào mừng đến The Garden. Quý khách có đặt bàn trước không?", time: "00:05" },
  { id: 2, speaker: "Bạn", text: "Good evening! Could I have a table for two, please? We don't have a reservation.", time: "00:18", detectedChunk: "c1" },
  { id: 3, speaker: "AI", text: "Of course! Right this way. Here's the menu. Can I start you with something to drink?", translation: "Tất nhiên! Mời quý khách đi theo đây. Đây là thực đơn. Quý khách muốn dùng gì trước không?", time: "00:30" },
  { id: 4, speaker: "Bạn", text: "Could you tell me more about today's specials? And I'd like to order a sparkling water for now.", time: "00:52", detectedChunk: "c3" },
  { id: 5, speaker: "AI", text: "Sure! Today's special is pan-seared sea bass with lemon butter sauce. It's very popular!", translation: "Dạ! Đặc biệt hôm nay là cá vược áp chảo với sốt bơ chanh. Rất được ưa chuộng!", time: "01:05" },
  { id: 6, speaker: "Bạn", text: "That sounds great, I'll go with the sea bass. And I'd like to order the Caesar salad as well.", time: "01:22", detectedChunk: "c4" }
];

export const MOCK_SKILL_PROGRESS: SkillProgress[] = [
  { label: "Fluency", current: 72, prev: 60, color: "#286FB4", desc: "Nói trơn tru, ít dừng và ngập ngừng", history: [45, 52, 58, 60, 63, 68, 72] },
  { label: "Listening", current: 68, prev: 58, color: "#22c55e", desc: "Nghe hiểu và phản hồi đúng ý", history: [40, 48, 53, 57, 58, 62, 68] },
  { label: "Vocabulary", current: 61, prev: 55, color: "#DF4C73", desc: "Vốn từ đa dạng và phù hợp ngữ cảnh", history: [38, 44, 49, 52, 55, 58, 61] },
  { label: "Tốc độ P.H", current: 55, prev: 48, color: "#f59e0b", desc: "Thời gian suy nghĩ và phản hồi", history: [30, 36, 40, 44, 47, 51, 55] },
  { label: "Phát âm", current: 64, prev: 56, color: "#7c3aed", desc: "Độ chuẩn xác của phát âm", history: [40, 46, 50, 54, 56, 60, 64] }
];

export const MOCK_PROGRESS_SESSION_HISTORY: ProgressSessionHistory[] = [
  { date: "Hôm nay", topic: "Kể về công việc", type: "AI Coach", duration: "18 phút", score: 74, emoji: "🎙️" },
  { date: "Hôm qua", topic: "Đặt bàn nhà hàng", type: "Tình huống", duration: "12 phút", score: 82, emoji: "🎭" },
  { date: "2 ngày trước", topic: "Small Talk at Work", type: "Cộng đồng", duration: "25 phút", score: 70, emoji: "👥" },
  { date: "3 ngày trước", topic: "Du lịch mơ ước", type: "AI Coach", duration: "20 phút", score: 78, emoji: "🎙️" },
  { date: "5 ngày trước", topic: "Check-in khách sạn", type: "Tình huống", duration: "14 phút", score: 68, emoji: "🎭" }
];

export const MOCK_LEVEL_REQUIREMENTS: LevelRequirement[] = [
  { level: "A1", done: true, sessions: 10, scenarios: 5, minFluency: 40 },
  { level: "A2", done: true, sessions: 20, scenarios: 10, minFluency: 50 },
  { level: "B1", done: false, current: true, sessions: 20, scenarios: 15, minFluency: 70, progress: { sessions: 12, scenarios: 7, fluency: 72 } },
  { level: "B2", done: false, sessions: 30, scenarios: 20, minFluency: 80, progress: null },
  { level: "C1", done: false, sessions: 40, scenarios: 30, minFluency: 90, progress: null }
];

export const MOCK_SCENARIO_CHUNKS: ScenarioChunk[] = [
  {
    id: "g1", label: "Mở đầu", function: "Bắt đầu tình huống",
    chunk: "Excuse me, could I...?",
    meaning: "Xin lỗi, tôi có thể...?",
    example: "Excuse me, could I ask you something about this?",
    exampleVi: "Xin lỗi, tôi có thể hỏi bạn điều này được không?",
    color: "#286FB4", bg: "#E2F0F9",
  },
  {
    id: "g2", label: "Đề nghị / Yêu cầu", function: "Nêu yêu cầu chính",
    chunk: "I'd like to...",
    meaning: "Tôi muốn...",
    example: "I'd like to know more about the options available.",
    exampleVi: "Tôi muốn biết thêm về các lựa chọn hiện có.",
    color: "#7c3aed", bg: "#F5F3FF",
  },
  {
    id: "g3", label: "Làm rõ", function: "Hỏi thêm để hiểu rõ hơn",
    chunk: "Could you explain...?",
    meaning: "Bạn có thể giải thích...?",
    example: "Could you explain how this works exactly?",
    exampleVi: "Bạn có thể giải thích chính xác điều này hoạt động thế nào không?",
    color: "#059669", bg: "#ECFDF5",
  },
  {
    id: "g4", label: "Đồng ý / Xác nhận", function: "Đồng ý hoặc xác nhận thông tin",
    chunk: "That works for me.",
    meaning: "Điều đó phù hợp với tôi.",
    example: "That works for me. Let's go ahead with that plan.",
    exampleVi: "Điều đó phù hợp với tôi. Hãy tiếp tục với kế hoạch đó.",
    color: "#f59e0b", bg: "#FFF5E5",
  },
  {
    id: "g5", label: "Từ chối / Thay thế", function: "Lịch sự từ chối hoặc đề xuất thay thế",
    chunk: "I'm afraid I can't..., but maybe...",
    meaning: "Tôi e rằng tôi không thể..., nhưng có lẽ...",
    example: "I'm afraid I can't do that right now, but maybe we could schedule it for next week?",
    exampleVi: "Tôi e rằng tôi không thể làm điều đó ngay bây giờ, nhưng có lẽ chúng ta có thể lên lịch cho tuần sau?",
    color: "#DF4C73", bg: "#FFF0F3",
  },
  {
    id: "g6", label: "Kết thúc", function: "Kết thúc cuộc trò chuyện",
    chunk: "Thank you so much for your help!",
    meaning: "Cảm ơn bạn rất nhiều vì đã giúp đỡ!",
    example: "Thank you so much for your help! I really appreciate it.",
    exampleVi: "Cảm ơn bạn rất nhiều vì đã giúp đỡ! Tôi thực sự trân trọng điều đó.",
    color: "#64748b", bg: "#F1F5F9",
  }
];

export const MOCK_SCENARIO_TASK_RESULTS: ScenarioTaskResult[] = [
  { id: "t1", label: "Yêu cầu đặt bàn", pass: true, feedback: "Dùng chunk 'Mở đầu' tự nhiên và lịch sự." },
  { id: "t2", label: "Hỏi menu / gợi ý", pass: true, feedback: "Câu hỏi rõ ràng, chunk 'Làm rõ' dùng đúng chức năng." },
  { id: "t3", label: "Gọi đồ uống", pass: true, feedback: "Đã gọi nước uống trong lượt đầu." },
  { id: "t4", label: "Gọi ít nhất 2 món", pass: true, feedback: "Đã gọi cá hồi và salad — đủ điều kiện." },
  { id: "t5", label: "Yêu cầu thanh toán", pass: false, feedback: "Chưa hoàn thành — buổi kết thúc trước khi gọi bill." }
];

export const MOCK_SCENARIO_OBJECTIVES = [
    "Chào hỏi và yêu cầu vị trí bàn",
    "Đặt món ăn và giải thích yêu cầu chế độ ăn",
    "Hỏi thông tin về các món ăn trong thực đơn",
    "Yêu cầu tính tiền và thanh toán gọn gàng"
  ];

export const MOCK_AI_COACH_TOPIC_GROUPS: AiCoachTopicGroup[] = [
  {
    group: "Gợi ý cho bạn",
    emoji: "✨",
    topics: [
      { label: "Giới thiệu bản thân", desc: "Tell me about yourself — Fluency cơ bản", emoji: "👤", level: "A2+" },
      { label: "Kể về công việc", desc: "What do you do? — Vocabulary công sở", emoji: "💼", level: "B1+" },
      { label: "Du lịch yêu thích", desc: "Travel & places — Sở thích của bạn", emoji: "✈️", level: "B1+" }
    ]
  },
  {
    group: "Giao tiếp hằng ngày",
    emoji: "☀️",
    topics: [
      { label: "Mua sắm & đặt hàng", desc: "Shopping & ordering", emoji: "🛍️", level: "A2+" },
      { label: "Hỏi đường & di chuyển", desc: "Directions & transport", emoji: "🗺️", level: "A2+" },
      { label: "Nói về cuối tuần", desc: "Weekend plans & activities", emoji: "🎉", level: "B1+" },
      { label: "Thời tiết & tin tức", desc: "Small talk starters", emoji: "🌤️", level: "A2+" }
    ]
  },
  {
    group: "Công việc & Chuyên nghiệp",
    emoji: "💼",
    topics: [
      { label: "Họp & thuyết trình", desc: "Meetings & presentations", emoji: "📊", level: "B2+" },
      { label: "Email & báo cáo", desc: "Professional writing style", emoji: "📧", level: "B1+" },
      { label: "Phỏng vấn xin việc", desc: "Job interview practice", emoji: "🤝", level: "B1+" },
      { label: "Đàm phán & thuyết phục", desc: "Negotiation skills", emoji: "💡", level: "B2+" }
    ]
  },
  {
    group: "Chủ đề nâng cao",
    emoji: "🚀",
    topics: [
      { label: "Tranh luận & quan điểm", desc: "Opinions & debates", emoji: "🗣️", level: "B2+" },
      { label: "Kể chuyện", desc: "Storytelling & narratives", emoji: "📖", level: "B2+" },
      { label: "Hài hước & chơi chữ", desc: "Humor & word play", emoji: "😄", level: "C1+" }
    ]
  }
];

export const MOCK_DASHBOARD_SKILLS: DashboardSkill[] = [
    { label: "Fluency", value: 72, color: "#286FB4" },
    { label: "Listening", value: 68, color: "#B0DDE4" },
    { label: "Vocabulary", value: 61, color: "#DF4C73" },
    { label: "Tốc độ P.H", value: 55, color: "#f59e0b" },
    { label: "Phát âm", value: 64, color: "#22c55e" }
  ];

export const MOCK_DASHBOARD_SHORTCUTS: DashboardShortcut[] = [
    { id: "ai-coach", label: "AI Coach", desc: "Nói chuyện với AI", emoji: "🎙️", color: "#286FB4", bg: "#E2F0F9" },
    { id: "scenarios", label: "Tình huống", desc: "Luyện kịch bản thực tế", emoji: "🎭", color: "#DF4C73", bg: "#FFF0F3" },
    { id: "community", label: "Cộng đồng", desc: "Voice room 3–5 người", emoji: "👥", color: "#7c3aed", bg: "#F5F3FF" },
    { id: "progress", label: "Tiến độ", desc: "Xem kỹ năng của bạn", emoji: "📊", color: "#059669", bg: "#ECFDF5" }
  ];

export const MOCK_FAQS: FaqItem[] = [
  {
    q: "AI Coach hoạt động như thế nào?",
    a: "AI Coach sử dụng công nghệ nhận diện giọng nói và xử lý ngôn ngữ tự nhiên để luyện tập cùng bạn theo thời gian thực. Sau mỗi buổi, AI phân tích và đưa ra báo cáo chi tiết về 5 kỹ năng."
  },
  {
    q: "Tôi cần thiết bị gì để sử dụng?",
    a: "Bạn cần micro (micro laptop, tai nghe có mic, hoặc micro rời) và kết nối internet ổn định. Trình duyệt Chrome hoặc Edge cho kết quả tốt nhất."
  },
  {
    q: "Tại sao micro của tôi không hoạt động?",
    a: "1) Kiểm tra quyền truy cập micro trong cài đặt trình duyệt. 2) Vào biểu tượng ổ khóa trên thanh địa chỉ → chọn Allow microphone. 3) Thử tải lại trang."
  },
  {
    q: "Điểm giao tiếp được tính như thế nào?",
    a: "Điểm giao tiếp tổng hợp là trung bình cộng của 5 chỉ số: Fluency (nói trơn tru), Listening (nghe hiểu), Vocabulary (từ vựng), Tốc độ P.H (phản hồi nhanh) và Phát âm."
  },
  {
    q: "Streak là gì và tại sao quan trọng?",
    a: "Streak là chuỗi ngày học liên tiếp. Mỗi ngày học ít nhất 1 buổi là streak được tính. Streak giúp hình thành thói quen và bạn nhận thêm XP bonus."
  }
];

export const MOCK_DASHBOARD_COMMUNICATION_SCORE = 67;

export const MOCK_QUICK_GUIDES: QuickGuide[] = [
  { emoji: "🎙️", title: "Bắt đầu buổi AI Coach", steps: ["Vào trang AI Coach", "Chọn chủ đề phù hợp", "Nhấn 'Bắt đầu nói'", "Cho phép quyền micro", "Luyện nói tự nhiên!"] },
  { emoji: "🎭", title: "Luyện tình huống Roleplay", steps: ["Vào Thư viện tình huống", "Chọn tình huống phù hợp trình độ", "Đọc bối cảnh và mẫu câu", "Nhấn 'Bắt đầu roleplay'", "Hoàn thành các nhiệm vụ"] },
  { emoji: "👥", title: "Tham gia phòng cộng đồng", steps: ["Vào Phòng cộng đồng", "Lọc theo level và chủ đề", "Nhấn 'Tham gia' phòng phù hợp", "Cho phép quyền micro", "Lắng nghe và tham gia trò chuyện!"] }
];

export const MOCK_REGISTER_HIGHLIGHTS: string[] = [
    "✅ Phân tích phát âm chi tiết",
    "✅ Hơn 200 tình huống thực tế",
    "✅ Phòng luyện tập cộng đồng",
    "✅ Theo dõi tiến độ hằng ngày"
  ];

export const MOCK_LOGIN_HIGHLIGHTS: LoginFeature[] = [
    { emoji: "🔥", label: "Streak 12 ngày liên tiếp" },
    { emoji: "⭐", label: "3.420 XP tích lũy" },
    { emoji: "🏆", label: "Level B1 — gần đến B2!" }
  ];

export const MOCK_PROFILE_INTERESTS: string[] = ["Du lịch", "Công nghệ", "Ẩm thực", "Kinh doanh", "Thể thao", "Âm nhạc", "Phim & TV", "Khoa học"];

export const MOCK_PROFILE_GOALS: string[] = ["Giao tiếp hằng ngày tự nhiên", "Thuyết trình công việc", "Phỏng vấn xin việc", "Học tập ở nước ngoài", "Du lịch tự túc"];

export const MOCK_LOGIN_DEFAULT_EMAIL = "minhanh@gmail.com";
export const MOCK_LOGIN_DEFAULT_PASSWORD = "••••••••";

export const MOCK_AI_COACH_REPORT_SKILLS: AiCoachSkillMetric[] = [
    { label: "Fluency", score: 74, prev: 68, color: "#286FB4", desc: "Nói tương đối trơn tru, ít dừng lâu." },
    { label: "Listening", score: 81, prev: 75, color: "#22c55e", desc: "Hiểu tốt các câu hỏi của AI." },
    { label: "Vocabulary", score: 62, prev: 61, color: "#DF4C73", desc: "Vốn từ tốt nhưng hay lặp từ." },
    { label: "Tốc độ P.H", score: 58, prev: 55, color: "#f59e0b", desc: "Cần rút ngắn thời gian suy nghĩ." },
    { label: "Phát âm", score: 69, prev: 64, color: "#7c3aed", desc: "Phát âm khá, một số âm cần chú ý." }
  ];

export const MOCK_AI_COACH_REPORT_SUMMARY: SummaryMetric[] = [
    { val: "18:24", label: "Thời lượng" },
    { val: "12:10", label: "Thời gian nói" },
    { val: "14", label: "Lượt trao đổi" }
  ];

export const MOCK_AI_COACH_REPORT_STRENGTHS: string[] = [
    "Duy trì chủ đề xuyên suốt, không bị lạc đề",
    "Dùng từ nối tốt: 'however', 'especially', 'because'",
    "Nghe và phản hồi đúng ý câu hỏi của AI"
  ];

export const MOCK_AI_COACH_REPORT_IMPROVEMENTS: string[] = [
    "Rút ngắn thời gian suy nghĩ trước khi trả lời",
    "Đa dạng hóa từ vựng — tránh lặp 'nice', 'good'",
    "Phát âm âm cuối '-ed' chưa rõ (visited, loved)"
  ];

export const MOCK_AI_COACH_REPORT_EXERCISES: RecommendedExercise[] = [
    { title: "Luyện âm 'th' và 'v'", type: "Phát âm", emoji: "🔤", mins: 5 },
    { title: "Shadowing: Travel podcast", type: "Tốc độ P.H", emoji: "🎧", mins: 10 },
    { title: "Tình huống: Đặt khách sạn", type: "Vocabulary", emoji: "🎭", mins: 15 }
  ];
