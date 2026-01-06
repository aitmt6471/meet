/**
 * AIT 회의록 자동화 시스템 - JavaScript
 * 회의록 제출 폼의 모든 로직을 처리합니다
 */

// DOM 요소
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

// 오늘 날짜를 기본값으로 설정
window.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    meetingDateInput.value = today;
    meetingDateInput.max = today;
});

// 파일 선택 시 정보 표시
fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileInfo.innerHTML = `
            <strong>선택된 파일:</strong> ${file.name}<br>
            <strong>크기:</strong> ${sizeMB} MB<br>
            <strong>형식:</strong> ${file.type || '알 수 없음'}
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
        // 로딩 시작
        showLoading('파일을 변환하고 있습니다...');

        // 폼 데이터 수집
        const formData = await collectFormData();

        // 서버에 전송
        showLoading('서버에 전송 중입니다...');
        const response = await submitToServer(formData);

        // 성공 처리
        hideLoading();
        showSuccess(response.request_id);

    } catch (error) {
        hideLoading();
        submitBtn.disabled = false;
        showError(error.message);
    }
});

/**
 * 폼 입력값 검증
 */
function validateForm() {
    const meetingDate = document.getElementById('meetingDate').value.trim();
    const author = document.getElementById('author').value.trim();
    const meetingTitle = document.getElementById('meetingTitle').value.trim();
    const attendeeEmails = document.getElementById('attendeeEmails').value.trim();
    const file = fileInput.files[0];

    // 필수 필드 체크
    if (!meetingDate) {
        return '회의 일자를 선택해주세요.';
    }

    if (!author) {
        return '작성자를 입력해주세요.';
    }

    if (!meetingTitle) {
        return '회의 제목을 입력해주세요.';
    }

    if (!attendeeEmails) {
        return '참석자 이메일을 입력해주세요.';
    }

    if (!file) {
        return '음성 파일을 선택해주세요.';
    }

    // 이메일 형식 검증
    const emails = parseEmails(attendeeEmails);
    if (emails.length === 0) {
        return '유효한 이메일 주소를 입력해주세요.';
    }

    const invalidEmails = emails.filter(email => !isValidEmail(email));
    if (invalidEmails.length > 0) {
        return `유효하지 않은 이메일 주소가 있습니다:\n${invalidEmails.join(', ')}`;
    }

    // 파일 형식 검증
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!CONFIG.ALLOWED_FILE_TYPES[fileExtension]) {
        return `지원하지 않는 파일 형식입니다.\n지원 형식: M4A, MP3, WAV`;
    }

    // 파일 크기 검증
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
        return `파일 크기가 너무 큽니다.\n최대 크기: ${CONFIG.MAX_FILE_SIZE_MB}MB\n현재 크기: ${fileSizeMB.toFixed(2)}MB`;
    }

    return null; // 검증 통과
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
 * 폼 데이터 수집 및 파일을 base64로 변환
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

    // 파일 정보
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const mimeType = CONFIG.ALLOWED_FILE_TYPES[fileExtension] || file.type;

    return {
        action: 'submit',
        apiKey: CONFIG.FRONTEND_CONFIG_API_KEY,
        meeting_date: meetingDate,
        author: author,
        meeting_title: meetingTitle,
        attendees: attendees || '',
        attendee_emails: emails.join(','),
        brief_note: briefNote || '',
        file: {
            filename: file.name,
            mimeType: mimeType,
            base64: base64File
        }
    };
}

/**
 * 파일을 base64로 변환
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            // data:audio/mp3;base64,XXXXX 형식에서 base64 부분만 추출
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };

        reader.onerror = () => {
            reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * 서버에 데이터 전송
 */
async function submitToServer(data) {
    // 설정 확인
    if (CONFIG.APPS_SCRIPT_WEBAPP_URL === 'YOUR_APPS_SCRIPT_WEBAPP_URL_HERE') {
        throw new Error('시스템 설정이 완료되지 않았습니다.\nconfig.js 파일에서 APPS_SCRIPT_WEBAPP_URL을 설정해주세요.');
    }

    if (CONFIG.FRONTEND_CONFIG_API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error('시스템 설정이 완료되지 않았습니다.\nconfig.js 파일에서 FRONTEND_CONFIG_API_KEY를 설정해주세요.');
    }

    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_WEBAPP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.FRONTEND_CONFIG_API_KEY
            },
            body: JSON.stringify(data)
        });

        // 응답 확인
        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        // 서버 응답 확인 (n8n webhook은 success 필드 사용)
        if (!result.success && !result.ok) {
            throw new Error(result.error || result.message || '서버에서 요청을 처리할 수 없습니다.');
        }

        return result;

    } catch (error) {
        // 네트워크 오류 처리
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('네트워크 연결을 확인해주세요.\n서버에 접속할 수 없습니다.');
        }

        throw error;
    }
}

/**
 * 로딩 표시
 */
function showLoading(message) {
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

    // 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
function showSuccess(requestId) {
    // 폼 숨기기
    formWrapper.style.display = 'none';

    // 접수 번호 표시
    document.getElementById('requestIdDisplay').textContent = requestId || 'N/A';

    // 성공 화면 표시
    successScreen.classList.add('show');

    // 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 새 제출을 위한 초기화
 */
function newSubmission() {
    // 성공 화면 숨기기
    successScreen.classList.remove('show');

    // 폼 표시 및 초기화
    formWrapper.style.display = 'block';
    resetForm();

    // 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 폼 초기화
 */
function resetForm() {
    form.reset();

    // 오늘 날짜로 재설정
    const today = new Date().toISOString().split('T')[0];
    meetingDateInput.value = today;

    // 파일 정보 숨김
    fileInfo.classList.remove('show');

    // 에러 메시지 숨김
    hideError();

    // 제출 버튼 활성화
    submitBtn.disabled = false;
}
