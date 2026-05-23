export const privacyPolicy = `
### Privacy Policy

---------------------------------

### Data Handling Information

#### We Collect

We collect two types of information:

1. **User-Provided Information**:

   - When you register for an account or use our Service, you may provide us with personal information such as your name, email address, and other contact details.
   - Specifically, if you wish to use the freely available GPT-4o mini model API calls, you are required to log in via Google or GitHub. This usage is limited to 10 messages a day to ensure fair usage.
   - Account data is stored server-side when you sign in.

2. **Automatically Collected Information**:
   - When you access the Service, certain information may be collected automatically. This includes your IP address, browser type, device type, and other technical information.
   - We may also use cookies and similar tracking technologies to collect data about your interactions with our Service.

### How We Handle Your Data

- **Server storage**: When you are signed in, conversations are stored in Cloudflare D1 (edge SQLite) associated with your account.
- **Secure requests**: Messages are sent over HTTPS to our Cloudflare Worker, which calls the xAI API. API keys configured in settings are used only from your browser (BYOK) or server-side secrets you control.
- **No External JavaScript**: We do not run any external JavaScript on our site, ensuring high security and privacy.
- **Data Deletion**: You can delete all your data, including API keys, configurations, and chat histories, at any time from your browser.
- **Tracking and Cookies**: We may use tracking and error logging tools to improve our services. Cookies might be used to enhance user experience and functionality.

### Use of Third-Party Services

Our Service relies on:

- **Cloudflare** (Workers, D1, Email Routing) for hosting, database, and authentication emails.
- **xAI** for AI inference and file storage (uploaded attachments are sent to xAI and auto-deleted per their retention policy).

These providers have their own privacy policies.

### Cookies

Authentication uses session cookies managed by Better Auth. You can sign out to clear your session.

### Third-Party Links and Content

The Service may contain links to third-party websites. We advise you to review their Privacy Policies, as we have no control over their content or practices. Links, images, and other internet content are suggested by AI and are not our responsibility.

### Contact Us

If you have any questions or concerns about this Privacy Policy, please contact us at [auth@lenylvt.cc](mailto:auth@lenylvt.cc).
`;
