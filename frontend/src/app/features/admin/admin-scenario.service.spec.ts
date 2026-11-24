import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminScenarioService, scenarioError } from './admin-scenario.service';

describe('AdminScenarioService', () => {
  const base = environment.apiUrl + '/admin/scenarios';
  let service: AdminScenarioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminScenarioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the chosen filters and cursor', async () => {
    const result = firstValueFrom(service.list({ q: 'cửa hàng', status: 'DRAFT', cursor: 'next' }));
    const request = http.expectOne((req) => req.method === 'GET' && req.url === base);
    expect(request.request.params.get('q')).toBe('cửa hàng');
    expect(request.request.params.get('status')).toBe('DRAFT');
    expect(request.request.params.get('cursor')).toBe('next');
    expect(request.request.params.has('level')).toBeFalse();
    request.flush({ items: [], nextCursor: null });
    expect((await result).items).toEqual([]);
  });

  it('sends publishing changes with the last known revision', async () => {
    const result = firstValueFrom(service.setStatus('id', { status: 'PUBLISHED', revision: 2 }));
    const request = http.expectOne(base + '/id/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'PUBLISHED', revision: 2 });
    request.flush({ id: 'id', revision: 3, status: 'PUBLISHED' });
    expect((await result).revision).toBe(3);
  });

  it('preserves field paths when publishing validation fails', () => {
    const fields = { 'chunks.1.distractorsEn': 'Add three distinct incorrect answers.' };
    const error = new HttpErrorResponse({
      status: 422, error: { code: 'SCENARIO_NOT_READY', details: { fields } }
    });
    expect(scenarioError(error).fields).toEqual(fields);
  });
});
