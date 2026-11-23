import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { components, paths } from '../../core/api/openapi';

type Schemas = components['schemas'];
export type ScenarioDetail = Schemas['AdminScenarioDetail'];
export type ScenarioInput = Schemas['AdminScenarioInput'];
export type ScenarioSummary = Schemas['AdminScenarioSummary'];
export type ScenarioStatus = ScenarioSummary['status'];
export type ScenarioStatusUpdate = Schemas['AdminScenarioStatusUpdate'];
export type ScenarioFilters = NonNullable<paths['/api/v1/admin/scenarios']['get']['parameters']['query']>;

export const categories: Record<ScenarioSummary['category'], string> = {
  DAILY_LIFE: 'Đời sống hằng ngày',
  SOCIAL: 'Giao tiếp xã hội',
  TRAVEL_SHOPPING: 'Du lịch và mua sắm',
  WORKPLACE: 'Công việc'
};

export const statuses: Record<ScenarioStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã ẩn'
};

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

@Injectable({ providedIn: 'root' })
export class AdminScenarioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/scenarios`;

  list(filters: ScenarioFilters) {
    let params = new HttpParams();
    for (const [name, value] of Object.entries(filters)) {
      if (value != null && value !== '') params = params.set(name, value);
    }
    return this.http.get<Schemas['AdminScenarioPage']>(this.url, { params });
  }

  get(id: string) {
    return this.http.get<ScenarioDetail>(`${this.url}/${id}`);
  }

  create(body: ScenarioInput) {
    return this.http.post<ScenarioDetail>(this.url, body);
  }

  update(id: string, body: Schemas['AdminScenarioUpdate']) {
    return this.http.put<ScenarioDetail>(`${this.url}/${id}`, body);
  }

  duplicate(id: string, body: Schemas['AdminScenarioDuplicate']) {
    return this.http.post<ScenarioDetail>(`${this.url}/${id}/duplicate`, body);
  }

  setStatus(id: string, body: ScenarioStatusUpdate) {
    return this.http.patch<ScenarioDetail>(`${this.url}/${id}/status`, body);
  }
}

interface AdminApiError {
  code?: string;
  details?: { fields?: Record<string, string>; errors?: { loc: (string | number)[]; msg: string }[] };
}

export function scenarioError(error: unknown): { message: string; fields: Record<string, string> } {
  const body = error instanceof HttpErrorResponse ? error.error as AdminApiError | null : null;
  const fields = body?.details?.fields ?? Object.fromEntries(
    (body?.details?.errors ?? []).map(({ loc, msg }) => [loc.slice(1).join('.'), msg])
  );
  switch (body?.code) {
    case 'SCENARIO_NOT_READY':
      return { message: 'Hãy kiểm tra các trường sau trước khi xuất bản.', fields };
    case 'VALIDATION_ERROR':
      return { message: 'Một số giá trị chưa hợp lệ.', fields };
    case 'SCENARIO_REVISION_CONFLICT':
      return { message: 'Bài học đã thay đổi trong phiên khác. Sao chép nội dung đang nhập trước khi tải lại.', fields };
    case 'SCENARIO_SLUG_CONFLICT':
      return { message: 'Mã đường dẫn này đã được sử dụng.', fields };
    case 'ADMIN_REQUIRED':
      return { message: 'Tài khoản hiện không có quyền quản trị.', fields };
    case 'SCENARIO_NOT_FOUND':
      return { message: 'Không tìm thấy bài học.', fields };
    case 'SCENARIO_IMMUTABLE':
    case 'INVALID_SCENARIO_TRANSITION':
      return { message: 'Trạng thái bài học đã thay đổi. Hãy tải lại trang.', fields };
    default:
      return { message: 'Không thể hoàn tất thao tác. Vui lòng thử lại.', fields };
  }
}
