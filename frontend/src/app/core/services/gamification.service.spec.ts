/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { GamificationService } from './gamification.service';
import { environment } from '../../../environments/environment';

describe('GamificationService', () => {
  let service: GamificationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GamificationService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(GamificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get dashboard data', () => {
    service.getDashboard().subscribe((res) => {
      expect(res.level).toBe('A1');
      expect(res.totalXp).toBe(500);
      expect(res.todayMissions.length).toBe(4);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/dashboard`);
    expect(req.request.method).toBe('GET');
    req.flush({
      greeting: 'Xin chào, Alex!',
      overallScore: 65,
      totalXp: 500,
      currentStreak: 3,
      level: 'A1',
      todayMissions: [
        { id: 'm-1', missionKey: 'coach_session', title: 'Hoàn thành 1 buổi AI Coach', xp: 50, conditionType: 'AI_COACH', status: 'PENDING', progress: 0, target: 1, isClaimed: false },
        { id: 'm-2', missionKey: 'scenario_lesson', title: 'Luyện 1 tình huống mới', xp: 50, conditionType: 'SCENARIO', status: 'PENDING', progress: 0, target: 1, isClaimed: false },
        { id: 'm-3', missionKey: 'room_session', title: 'Tham gia phòng cộng đồng', xp: 50, conditionType: 'ROOM', status: 'PENDING', progress: 0, target: 1, isClaimed: false },
        { id: 'm-4', missionKey: 'streak_maintain', title: 'Duy trì streak', xp: 20, conditionType: 'STREAK', status: 'COMPLETED', progress: 1, target: 1, isClaimed: false },
      ],
      missionsCompletedCount: 1,
      missionsTotalCount: 4,
      missionsProgressPct: 25,
      skills: [],
      recentSessions: [],
      motivationalCard: { title: 'Cố lên!', message: 'Luyện tập thêm', targetLevel: 'A2', actionText: 'Bắt đầu', actionTarget: '/ai-coach' }
    });
  });

  it('should get gamification summary with D-02 advancement conditions', () => {
    service.getGamificationSummary().subscribe((res) => {
      expect(res.currentLevel).toBe('A1');
      expect(res.advancement.conditions.length).toBe(3);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/gamification/summary`);
    expect(req.request.method).toBe('GET');
    req.flush({
      totalXp: 500,
      currentLevel: 'A1',
      currentStreak: 3,
      bestStreak: 7,
      badgesEarnedCount: 1,
      badgesTotalCount: 6,
      advancement: {
        targetLevel: 'A2',
        conditions: [
          { type: 'overall_score', label: 'Điểm tổng hợp trung bình', target: 40, current: 45, met: true, unit: 'điểm' },
          { type: 'total_sessions', label: 'Số session hoàn thành', target: 5, current: 3, met: false, unit: 'session' },
          { type: 'total_scenarios', label: 'Số tình huống hoàn thành', target: 3, current: 1, met: false, unit: 'tình huống' },
        ],
        allMet: false,
      }
    });
  });

  it('should claim daily mission reward', () => {
    service.claimMission('m-123').subscribe((res) => {
      expect(res.success).toBeTrue();
      expect(res.xpAwarded).toBe(50);
      expect(res.newTotalXp).toBe(550);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/missions/m-123/claim`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, xpAwarded: 50, newTotalXp: 550 });
  });

  it('should query progress skills and history', () => {
    service.getProgressSkills().subscribe((res) => {
      expect(res.skills.length).toBe(1);
      expect(res.skills[0].isReference).toBeTrue();
    });

    const sReq = httpMock.expectOne(`${environment.apiUrl}/progress/skills`);
    sReq.flush({
      skills: [
        { key: 'pronunciation', label: 'Phát âm', desc: 'Độ chuẩn xác', current: 75, prev: 70, diff: 5, status: 'Tốt', color: '#DF4C73', isReference: true }
      ],
      formulaVersion: 'v1.0'
    });

    service.getProgressHistory('cursor-1', 10, 'COACH').subscribe((res) => {
      expect(res.items.length).toBe(0);
      expect(res.hasMore).toBeFalse();
    });

    const hReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/progress/history` && r.params.get('cursor') === 'cursor-1');
    expect(hReq.request.method).toBe('GET');
    hReq.flush({ items: [], nextCursor: null, hasMore: false });
  });

  it('should manage notifications mark read', () => {
    service.markNotificationRead('notif-1').subscribe((res) => {
      expect(res.read).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/notifications/notif-1/read`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 'notif-1', read: true });

    service.markAllNotificationsRead().subscribe((res) => {
      expect(res.success).toBeTrue();
    });

    const allReq = httpMock.expectOne(`${environment.apiUrl}/notifications/read-all`);
    expect(allReq.request.method).toBe('PATCH');
    allReq.flush({ success: true });
  });
});
