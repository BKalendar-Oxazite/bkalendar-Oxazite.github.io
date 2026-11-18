import { ASIA_HO_CHI_MINH, type GapiEvent } from './core/mod';

export const DEFAULT_CLIENT_ID =
	'864474557161-jci8mppafkd21prbsg5n3ll4m23i8vda.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const { PUBLIC_GOOGLE_API_KEY, PUBLIC_GOOGLE_CLIENT_ID } = import.meta.env;

type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type TokenClient = { requestAccessToken(options: { prompt: string }): void };
declare const google: {
	accounts: {
		oauth2: {
			initTokenClient(config: {
				client_id: string;
				scope: string;
				hosted_domain: string;
				callback(response: TokenResponse): void;
				error_callback(error: { type: string }): void;
			}): TokenClient;
			hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
		};
	};
};

function loadScript(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = url;
		script.onload = () => {
			clearTimeout(timeout);
			resolve();
		};
		const onError = () => {
			clearTimeout(timeout);
			script.remove();
			reject(new Error('Không tải được Lịch Google. Bạn có thể dùng tệp .ics.'));
		};
		const timeout = setTimeout(onError, 12000);
		script.onerror = onError;
		document.head.append(script);
	});
}

let initialization: Promise<void> | undefined;

export function prepareGoogle(): Promise<void> {
	initialization ??= Promise.all([
		typeof gapi === 'undefined' && loadScript('https://apis.google.com/js/api.js'),
		typeof google === 'undefined' && loadScript('https://accounts.google.com/gsi/client')
	])
		.then(
			() =>
				new Promise<void>((resolve, reject) =>
					gapi.load('client', {
						callback: resolve,
						onerror: () => reject(new Error('Không tải được Google Calendar API.')),
						timeout: 10000,
						ontimeout: () => reject(new Error('Google Calendar API phản hồi quá chậm.'))
					})
				)
		)
		.then(() =>
			gapi.client.init({
				discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
				...(PUBLIC_GOOGLE_API_KEY ? { apiKey: PUBLIC_GOOGLE_API_KEY } : {})
			})
		)
		.catch((error) => {
			initialization = undefined;
			throw error;
		});
	return initialization;
}

export function authorizeGoogle(): Promise<void> {
	return new Promise((resolve, reject) => {
		const client = google.accounts.oauth2.initTokenClient({
			client_id: PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID,
			scope: SCOPE,
			hosted_domain: 'hcmut.edu.vn',
			callback(response) {
				if (
					!response.access_token ||
					!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)
				) {
					reject(
						new Error(
							response.error_description || response.error || 'Bạn chưa cấp quyền Lịch Google.'
						)
					);
					return;
				}
				gapi.client.setToken({ access_token: response.access_token });
				resolve();
			},
			error_callback({ type }) {
				reject(
					new Error(
						type === 'popup_closed'
							? 'Bạn đã đóng cửa sổ đăng nhập Google.'
							: 'Không mở được cửa sổ đăng nhập Google. Hãy kiểm tra quyền mở cửa sổ bật lên.'
					)
				);
			}
		});
		client.requestAccessToken({ prompt: '' });
	});
}

export async function createCalendar(summary: string): Promise<string> {
	const { result } = await gapi.client.calendar.calendars.insert({
		summary,
		timeZone: ASIA_HO_CHI_MINH
	});
	if (!result.id) throw new Error('Google chưa trả về mã lịch.');
	return result.id;
}

export async function insertEvent(calendarId: string, event: GapiEvent, id: string): Promise<void> {
	try {
		await gapi.client.calendar.events.insert({ calendarId, resource: { ...event, id } });
	} catch (error) {
		// An earlier attempt can succeed on Google's side even if the browser loses the response.
		if ((error as { status?: number }).status !== 409) throw error;
	}
}

export function googleErrorMessage(error: unknown): string {
	const failure = error as { message?: string; result?: { error?: { message?: string } } };
	const detail = failure?.result?.error?.message || failure?.message || '';
	return /origin_mismatch|access_denied|org_internal|test user/i.test(detail)
		? 'Google từ chối quyền. Hãy dùng tài khoản @hcmut.edu.vn hoặc kiểm tra cấu hình OAuth của trang.'
		: detail || 'Google chưa thể xử lý yêu cầu. Bạn có thể thử lại hoặc dùng tệp .ics.';
}
