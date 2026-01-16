/**
 * AIT 회의록 자동화 시스템 - 프론트엔드 설정
 * 
 * 배포 전 반드시 아래 값들을 실제 환경에 맞게 설정하세요.
 */

const CONFIG = {
    // Google Apps Script Web App URL
    // 예: "https://docs.google.com/spreadsheets/d/16uNqfsxleg8vX-_52fnk3KY4xNtDzhwgFuvAs9NwIwg/edit?gid=0#gid=0"
    APPS_SCRIPT_WEBAPP_URL: "https://aitechn8n.ngrok.app/webhook/meeting-submit",

    // API 인증 키
    FRONTEND_CONFIG_API_KEY: "AIT_MEETING_SECRET_API_KEY",

    // 최대 파일 크기 (MB)
    // Google Drive를 통해 대용량 파일 처리 가능
    MAX_FILE_SIZE_MB: 100,

    // 대용량 파일은 Google Drive로 처리 (MB)
    // 40MB 이상 파일은 자동으로 Google Drive에 업로드됩니다
    DRIVE_UPLOAD_THRESHOLD_MB: 40,

    // 지원되는 파일 형식
    ALLOWED_FILE_TYPES: {
        'm4a': 'audio/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
    },

    // Google Drive API 설정
    // Google Cloud Console에서 발급받은 값으로 교체하세요
    GOOGLE_CLIENT_ID: "549977198012-161jnnm4dpcrnfmorp2qen2197v84abc.apps.googleusercontent.com",
    GOOGLE_API_KEY: "AIzaSyD3vTBGNx7XEv19JD28K4UnfXGu7wJav7A", // 선택사항
    GOOGLE_SCOPES: "https://www.googleapis.com/auth/drive.file",
    GOOGLE_DISCOVERY_DOCS: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
};
