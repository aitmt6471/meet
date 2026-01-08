/**
 * AIT 회의록 자동화 시스템 - 프론트엔드 설정
 * 
 * 배포 전 반드시 아래 값들을 실제 환경에 맞게 설정하세요.
 */

const CONFIG = {
    // Google Apps Script Web App URL
    // 예: "https://docs.google.com/spreadsheets/d/16uNqfsxleg8vX-_52fnk3KY4xNtDzhwgFuvAs9NwIwg/edit?gid=0#gid=0"
    APPS_SCRIPT_WEBAPP_URL: "https://nonseptate-axel-rousingly.ngrok-free.dev/webhook/meeting-submit",

    // API 인증 키
    FRONTEND_CONFIG_API_KEY: "AIT_MEETING_SECRET_API_KEY",

    // 최대 파일 크기 (MB)
    MAX_FILE_SIZE_MB: 40,

    // 지원되는 파일 형식
    ALLOWED_FILE_TYPES: {
        'm4a': 'audio/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
    }
};
