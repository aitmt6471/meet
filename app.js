/**
 * AIT 회의록 자동화 시스템 - JavaScript (Google Drive 통합)
 * 회의록 제출 폼의 모든 로직을 처리합니다
 */

// ===== Google Drive API 관련 =====
let tokenClient;
let accessToken = null;
let gapiInited = false;
let gisInited = false;

/**
 * Google API 초기화
 */
function initializeGoogleAPIs() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: CONFIG.GOOGLE_API_KEY,
            discoveryDocs: CONFIG.GOOGLE_DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log('✅ GAPI 초기화 완료');
        maybeEnableButtons();
    } catch (error) {
        console.error('GAPI 초기화 오류:', error);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.GOOGLE_SCOPES,
        callback: '', // 나중에 설정
    });
    gisInited = true;
    console.log('✅ GIS 초기화 완료');
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        console.log('✅ Google API 준비 완료');
    }
}

/**
 * Google Drive 액세스 토큰 획득
 */
function getAccessToken() {
    return new Promise((resolve, reject) => {
        if (accessToken) {
            resolve(accessToken);
            return;
        }

        tokenClient.callback = (response) => {
            if (response.error !== undefined) {
                reject(response);
                return;
            }
            accessToken = response.access_token;
            resolve(accessToken);
        };

        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
}

/**
 * Google Drive에 파일 업로드
 */
async function uploadToDrive(file) {
    try {
        console.log(`📤 Google Drive 업로드 시작: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

        // 액세스 토큰 획득
        const token = await getAccessToken();

        // 메타데이터
        const metadata = {
            name: file.name,
            mimeType: file.type
        };

        // FormData로 multipart 업로드
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Drive 업로드 실패: ${error}`);
        }

        const result = await response.json();
        console.log('✅ Drive 업로드 성공:', result);

        return {
            fileId: result.id,
            fileName: result.name,
            fileSize: result.size,
            webViewLink: result.webViewLink
        };
    } catch (error) {
        console.error('❌ Drive 업로드 오류:', error);
        throw new Error(`Google Drive 업로드 실패: ${error.message}`);
    }
}

// ===== 기존 DOM 요소 =====
const form = document.getElementById('meetingForm');
const submitBtn = document.getElementById('submitBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const formWrapper = document.getElementById('formWrapper');
const successScreen = document.getElementById('successScreen');
const fileInput = document.getElementById('audioFile');
const fileInfo = document.getElementById('fileInfo');
const meetingDateInput = document.getElementById('meetingDate');

// ===== 초기화 =====
window.addEventListener('DOMContentLoaded', () => {
    // 오늘 날짜 기본값 설정
    const today = new Date().toISOString().split('T')[0];
    meetingDateInput.value = today;
    meetingDateInput.max = today;

    // Google API 초기화
    if (CONFIG.GOOGLE_CLIENT_ID && CONFIG.GOOGLE_CLIENT_ID !== 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
        try {
            initializeGoogleAPIs();
            // GIS가 로드되면 자동 호출됨
            window.gisLoaded = gisLoaded;
        } catch (error) {
            console.warn('Google API 초기화 실패 (선택사항):', error);
        }
    } else {
        console.warn('⚠️ Google Client ID가 설정되지 않았습니다. 대용량 파일 업로드가 제한됩니다.');
    }
});

// 파일 선택 시 정보 표시
fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const uploadMethod = sizeMB >= CONFIG.DRIVE_UPLOAD_THRESHOLD_MB ? '📂 Google Drive' : '📄 직접 전송';

        fileInfo.innerHTML = `
            <strong>선택된 파일:</strong> ${file.name}<br>
            <strong>크기:</strong> ${sizeMB} MB<br>
            <strong>형식:</strong> ${file.type || '알 수 없음'}<br>
            <strong>전송 방식:</strong> ${uploadMethod}
        `;
        fileInfo.classList.add('show');
    } else {
        fileInfo.classList.remove('show');
    }
});

// 폼 제출 처리
form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // 에러 메시지 초기화
    hideError();

    // 입력값 검증
    const validationError = validateForm();
    if (validationError) {
        showError(validationError);
        return;
    }

    // 제출 버튼 비활성화 (더블클릭 방지)
    submitBtn.disabled = true;

    try {
        // 파일 크기 확인
        const file = fileInput.files[0];
        const fileSizeMB = file.size / (1024 * 1024);

        let formData;

        // 파일 크기에 따라 처리 방식 결정
        if (fileSizeMB >= CONFIG.DRIVE_UPLOAD_THRESHOLD_MB) {
            // 대용량: Google Drive 업로드
            showLoading('Google Drive에 파일을 업로드하는 중...');
            const driveFile = await uploadToDrive(file);

            showLoading('회의록 처리 요청 중...');
            formData = await collectFormDataWithDrive(driveFile);
        } else {
            // 소용량: 기존 base64 방식
            showLoading('파일을 변환하고 있습니다...');
            formData = await collectFormData();
        }

        // 서버로 전송
        showLoading('회의록을 처리하고 있습니다...');
        await submitToServer(formData);

        // 성공 처리
        hideLoading();
        showSuccess(formData);

    } catch (error) {
        console.error('제출 오류:', error);
        hideLoading();
        showError(error.message || '제출 중 오류가 발생했습니다. 다시 시도해주세요.');
        submitBtn.disabled = false;
    }
});

/**
 * 폼 검증
 */
function validateForm() {
    const meetingDate = document.getElementById('meetingDate').value.trim();
    const author = document.getElementById('author').value.trim();
    const meetingTitle = document.getElementById('meetingTitle').value.trim();
    const attendees = document.getElementById('attendees').value.trim();
    const attendeeEmails = document.getElementById('attendeeEmails').value.trim();
    const file = fileInput.files[0];

    if (!meetingDate) return '회의 일자를 선택해주세요.';
    if (!author) return '작성자를 입력해주세요.';
    if (!meetingTitle) return '회의 제목을 입력해주세요.';
    if (!attendees) return '참석자를 입력해주세요.';
    if (!attendeeEmails) return '참석자 이메일을 입력해주세요.';

    // 이메일 검증
    const emails = parseEmails(attendeeEmails);
    const invalidEmails = emails.filter(email => !isValidEmail(email));

    if (invalidEmails.length > 0) {
        return `유효하지 않은 이메일: ${invalidEmails.join(', ')}`;
    }

    if (!file) return '음성 파일을 선택해주세요.';

    // 파일 형식 검증
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!CONFIG.ALLOWED_FILE_TYPES[fileExt]) {
        return `지원되지 않는 파일 형식입니다. (지원: ${Object.keys(CONFIG.ALLOWED_FILE_TYPES).join(', ')})`;
    }

    // 파일 크기 검증 (최대 허용)
    const fileSizeMB = file.size / (1024 * 1024);
    const maxSize = 100; // 100MB까지 허용 (Drive 사용 시)

    if (fileSizeMB > maxSize) {
        return `파일 크기가 너무 큽니다. (최대: ${maxSize}MB, 현재: ${fileSizeMB.toFixed(2)}MB)`;
    }

    return null;
}

/**
 * 이메일 주소 파싱 (줄바꿈, 쉼표, 세미콜론 지원)
 */
function parseEmails(emailString) {
    // 줄바꿈, 쉼표, 세미콜론으로 분리
    const emails = emailString
        .split(/[\n,;]+/)
        .map(email => email.trim())
        .filter(email => email.length > 0);

    // 중복 제거
    return [...new Set(emails)];
}

/**
 * 이메일 형식 검증
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 폼 데이터 수집 (Google Drive 방식)
 */
async function collectFormDataWithDrive(driveFile) {
    const meetingDate = document.getElementById('meetingDate').value.trim();
    const author = document.getElementById('author').value.trim();
    const meetingTitle = document.getElementById('meetingTitle').value.trim();
    const attendees = document.getElementById('attendees').value.trim();
    const attendeeEmails = document.getElementById('attendeeEmails').value.trim();
    const briefNote = document.getElementById('briefNote').value.trim();

    // 이메일 파싱
    const emails = parseEmails(attendeeEmails);

    return {
        meeting_date: meetingDate,
        author: author,
        meeting_title: meetingTitle,
        attendees: attendees,
        attendee_emails: emails.join(', '),
        brief_note: briefNote,

        // Google Drive 정보
        file_source: 'google_drive',
        file_id: driveFile.fileId,
        file_name: driveFile.fileName,
        file_size: driveFile.fileSize,
        file_type: fileInput.files[0].type
    };
}

/**
 * 폼 데이터 수집 및 파일을 base64로 변환 (기존 방식)
 */
async function collectFormData() {
    const meetingDate = document.getElementById('meetingDate').value.trim();
    const author = document.getElementById('author').value.trim();
    const meetingTitle = document.getElementById('meetingTitle').value.trim();
    const attendees = document.getElementById('attendees').value.trim();
    const attendeeEmails = document.getElementById('attendeeEmails').value.trim();
    const briefNote = document.getElementById('briefNote').value.trim();
    const file = fileInput.files[0];

    // 이메일 파싱
    const emails = parseEmails(attendeeEmails);

    // 파일을 base64로 변환
    const base64File = await fileToBase64(file);

    return {
        meeting_date: meetingDate,
        author: author,
        meeting_title: meetingTitle,
        attendees: attendees,
        attendee_emails: emails.join(', '),
        brief_note: briefNote,

        // Base64 파일 정보
        file_source: 'base64',
        file_name: file.name,
        file_data: base64File,
        file_type: file.type
    };
}

/**
 * 파일을 Base64로 변환
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * 서버로 데이터 전송
 */
async function submitToServer(data) {
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_WEBAPP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`서버 오류: ${response.status} - ${errorText}`);
        }

        return await response.json().catch(() => ({}));
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
        }
        throw error;
    }
}

/**
 * 로딩 표시
 */
function showLoading(message = '처리 중...') {
    loadingMessage.textContent = message;
    loadingOverlay.classList.add('show');
}

/**
 * 로딩 숨김
 */
function hideLoading() {
    loadingOverlay.classList.remove('show');
}

/**
 * 에러 메시지 표시
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 8000);
}

/**
 * 에러 메시지 숨김
 */
function hideError() {
    errorMessage.classList.remove('show');
}

/**
 * 성공 화면 표시
 */
function showSuccess(data) {
    formWrapper.style.display = 'none';
    successScreen.classList.add('show');

    document.getElementById('successTitle').textContent = data.meeting_title;
    document.getElementById('successDate').textContent = data.meeting_date;
    document.getElementById('successAuthor').textContent = data.author;

    const emailList = data.attendee_emails.split(',').map(email => email.trim());
    document.getElementById('successEmails').textContent = emailList.join(', ');
}

/**
 * 새 제출을 위한 폼 리셋
 */
function resetForm() {
    successScreen.classList.remove('show');
    formWrapper.style.display = 'block';
    form.reset();
    fileInfo.classList.remove('show');

    const today = new Date().toISOString().split('T')[0];
    meetingDateInput.value = today;

    submitBtn.disabled = false;
}

// 새 제출 버튼 이벤트
document.getElementById('newSubmitBtn').addEventListener('click', resetForm);
