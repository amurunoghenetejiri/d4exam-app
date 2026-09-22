/* auto-generated capacitor server stubs — SPA runs offline; server work uses Supabase client or online API */
const _noop = async () => null;
const _ORIGIN = 'https://d4exam.name.ng';
export const createServerFn = (opts) => {
  let method = (opts && opts.method) || 'POST';
  const chain = {
    method(m) { method = m; return chain; },
    inputValidator() { return chain; },
    middleware() { return chain; },
    handler(_h) {
      const invoker = async (input) => {
        // Client-side: most server logic is unavailable offline; callers should use Supabase.
        // Online: attempt a soft no-op so UI does not crash; real auth uses client paths.
        try {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return { error: 'You are offline. Connect to the internet for this action.' };
          }
        } catch (_) {}
        return { error: 'This action needs the online D4EXAM service. Open the app while online and try again.' };
      };
      invoker.url = '';
      return invoker;
    },
  };
  return chain;
};
export const createMiddleware = () => ({ server: (h) => h });
export const createStartHandler = () => () => {};
export const getCookie = () => undefined;
export const setCookie = () => {};
export const getRequest = () => undefined;
export const getWebRequest = () => undefined;
export const getResponse = () => undefined;
export const getStartContext = () => ({});
export default {};
export const SUPPORT_INBOX = _noop;
export const SUPPORT_PHONE = _noop;
export const completeAppUnlockReset = _noop;
export const createPerson = _noop;
export const createSchoolUser = _noop;
export const dispatchPushToUser = _noop;
export const enrolStudentInCourse = _noop;
export const ensureLoginAccount = _noop;
export const getMyCbtResultServer = _noop;
export const getMyStudentContext = _noop;
export const getSchoolDashboardCounts = _noop;
export const hasAdminKey = _noop;
export const importStudentsBulk = _noop;
export const listSchoolApplications = _noop;
export const loginWithSchoolCode = _noop;
export const notifyAppPasswordHelp = _noop;
export const notifySchoolApplicationReceived = _noop;
export const notifyStudentEmailLinked = _noop;
export const notifySuperAdminsApplicationEmail = _noop;
export const notifyTeacherCoursesAssigned = _noop;
export const notifyWelcomeRole = _noop;
export const processExamReminders = _noop;
export const provisionStudentLogin = _noop;
export const requestAppUnlockResetEmail = _noop;
export const resolveStudentNamesForOfficer = _noop;
export const reviewSchoolApplication = _noop;
export const saveCbtResultServer = _noop;
export const searchStudyVideos = _noop;
export const sendAppPasswordHelpEmail = _noop;
export const sendAppUnlockResetLinkEmail = _noop;
export const sendEmail = _noop;
export const sendOfficerExamSubmittedEmail = _noop;
export const sendPlatformMessage = _noop;
export const sendResultReleasedEmail = _noop;
export const sendSchoolApplicationNeedsInfoEmail = _noop;
export const sendSchoolApplicationReceivedEmail = _noop;
export const sendSchoolApplicationRejectedEmail = _noop;
export const sendSchoolApplicationUnderReviewEmail = _noop;
export const sendSchoolApprovalEmail = _noop;
export const sendStaffWelcomeEmail = _noop;
export const sendStudentEmailLinkedEmail = _noop;
export const sendSuperAdminNewApplicationEmail = _noop;
export const sendTeacherCoursesAssignedEmail = _noop;
export const sendTestNotificationToSelf = _noop;
export const sendWelcomeRoleEmail = _noop;
export const serverNotifyStudentsExamApproved = _noop;
export const setApprovedSchoolAdminPassword = _noop;
export const signInWithSchoolCode = _noop;
export const studentAuthEmailCandidates = _noop;
export const submitSupportMessage = _noop;
export const supabaseAdmin = _noop;
export const uploadSchoolLogoServer = _noop;
export const upsertStudent = _noop;
export const writeLoginAudit = _noop;
