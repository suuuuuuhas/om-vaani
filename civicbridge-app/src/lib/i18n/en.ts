import type { Locale } from "@/lib/types";

/**
 * Authored English copy. This object defines the required shape:
 * the Hindi and Telugu dictionaries must satisfy the same type.
 */
export const en = {
  app: {
    name: "Civic Sathi",
    tagline: "One calm place to prepare, track, and escalate a grievance.",
    prototypeBanner:
      "Independent prototype, not a government service. Example people, cases, IDs and case updates are fictional.",
    skipToContent: "Skip to main content",
    footerNote:
      "Civic Sathi is independent and is not affiliated with a government body. Cases are stored in this browser; voice and AI features send information to their providers.",
    notLegalAdvice:
      "Escalation guidance is informational and source-linked. It is not legal advice."
  },
  nav: {
    home: "New grievance",
    review: "Review",
    dashboard: "My cases"
  },
  lang: {
    label: "Language",
    en: "English",
    hi: "हिन्दी",
    te: "తెలుగు"
  },
  demo: {
    useCitizen: "Continue as demo citizen",
    activeAs: "Demo citizen: {name}",
    note: "No account or phone number is required to start."
  },
  intake: {
    heading: "Describe your problem in your own words",
    subheading:
      "Civic Sathi identifies which grievance system fits, prepares the details, tracks progress, and suggests a sourced next step when it is time to escalate.",
    textLabel: "What went wrong?",
    textHint: "Write 2-5 sentences. Include reference numbers if you have them.",
    placeholder:
      "Example: I bought a mixer online and it stopped working within a week. The seller refused a refund...",
    examplesLabel: "Try a safe example",
    example1:
      "I ordered a pressure cooker for Rs 2,400 from ShopKart. It arrived with a dented lid, and the seller has ignored my refund request for three weeks. Order number ORD-778812.",
    example2:
      "My EPF withdrawal claim has been pending for 18 days. My UAN is 101234567890 and my employer says the claim was never received on their side.",
    example3:
      "My confirmed train ticket was not used because the train was 6 hours late. PNR 4529871653. I want to know how to file a TDR for the refund.",
    privacyTitle: "Before you type",
    privacyBody:
      "Do not type or speak sensitive identifiers. Text is screened before AI processing; voice recordings are sent to Gnani for transcription:",
    privacyAadhaar: "Aadhaar numbers",
    privacyPan: "PAN numbers",
    privacyOtp: "OTPs and PINs",
    privacyPassword: "Passwords",
    privacyCvv: "Card CVV numbers",
    privacyBank: "Bank login credentials",
    submit: "Identify my grievance system",
    submitting: "Checking your description…",
    charCount: "{n} / 4000 characters",
    aiLoading: "Reading your description…",
    aiErrorTitle: "The AI service did not respond",
    aiErrorBody:
      "We prepared your review using offline rules instead. You can continue safely.",
    fallbackNotice: "Prepared with offline rules - AI was unavailable.",
    modeAi: "AI-assisted",
    modeFallback: "Offline rules",
    blockedTitle: "Please remove sensitive details",
    blockedBody:
      "Your description contains information this prototype must not process:",
    minChars: "Please describe the problem in at least 40 characters."
  },
  confidence: {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence - please check"
  },
  review: {
    title: "Review before saving",
    missingDraftTitle: "Nothing to review yet",
    missingDraftBody: "Start by describing your grievance on the first page.",
    backHome: "Describe a grievance",
    triageHeading: "What we understood",
    summaryHeading: "Summary",
    disclaimerHeading: "Keep in mind",
    correctHeading: "Is this correct?",
    correctPrompt:
      "If the identified system looks wrong, choose the right one. Your correction updates tracking and escalation rules.",
    systemLabel: "Grievance system",
    subflowLabel: "Railway issue type",
    subflowNone: "Not applicable",
    fieldsHeading: "Case details",
    fieldsHint: "Edit anything that is missing or wrong.",
    missingHeading: "Missing information",
    missingBody: "Adding these makes your case easier to act on:",
    attachmentsHeading: "Evidence",
    attachmentsHint:
      "This prototype bundles fictional sample documents. No real files are uploaded.",
    attachReceipt: "Include sample receipt",
    attachScreenshot: "Include sample confirmation screenshot",
    receiptName: "sample-receipt.pdf",
    screenshotName: "sample-confirmation.png",
    originalHeading: "Your original description",
    originalEditLabel: "Edit description",
    submit: "Save on this browser",
    submitting: "Saving…",
    submitError: "Could not save the case locally. Please try again."
  },
  fields: {
    pnr: "PNR number",
    uan: "UAN",
    orderNumber: "Order number",
    transactionId: "Transaction ID",
    amount: "Amount (Rs)",
    purchaseDate: "Purchase date",
    merchant: "Company or seller",
    complaintNumber: "Complaint reference",
    trainNumber: "Train number",
    coach: "Coach or berth",
    journeyDate: "Date of journey",
    ticketClass: "Ticket class",
    claimId: "Claim ID",
    employerId: "Establishment ID",
    productName: "Product or service"
  },
  fieldHints: {
    pnr: "10 characters, printed on the e-ticket.",
    uan: "12 digits, from your EPFO passbook or salary slip.",
    orderNumber: "From the order confirmation email or app.",
    amount: "Rough value of the claim is enough."
  },
  dashboard: {
    title: "My cases",
    subtitle: "Cases are stored in this browser. AI and voice features send information to their providers.",
    emptyTitle: "No cases yet",
    emptyBody:
      "Saved cases appear here. Statuses and references are simulated; no grievance is filed.",
    emptyCta: "Start a new grievance",
    colCase: "Case",
    colSystem: "System",
    colStatus: "Status",
    colAge: "Age",
    colNextAction: "Suggested next action",
    viewCase: "Open case",
    resetDemo: "Reset demo data",
    resetConfirmTitle: "Reset all demo data?",
    resetConfirmBody:
      "This deletes every local case and restores the five sample cases.",
    resetYes: "Reset",
    resetNo: "Cancel",
    daysAgo: "{n} days ago",
    dayAgo: "1 day ago",
    today: "Today",
    overdueTag: "Overdue"
  },
  status: {
    submitted: "Saved locally",
    in_progress: "In progress",
    awaiting_response: "Waiting for a response",
    response_received: "Response received",
    closed_unsatisfactory: "Closed without resolution"
  },
  timeline: {
    heading: "Timeline",
    submitted: "Case saved locally for {system}; not submitted",
    acknowledged: "Acknowledged by {system}",
    in_progress: "Marked in progress by {system}",
    response_received: "Response received from {system}",
    reminder: "Expected response window elapsed",
    closed_unsatisfactory: "Closed without a satisfactory resolution",
    escalation_available: "Escalation options became available"
  },
  systems: {
    nch_name: "National Consumer Helpline",
    epfo_name: "EPFO (Provident Fund)",
    railmadad_name: "RailMadad (Indian Railways)",
    tdr_name: "Railways - TDR refund",
    nch_with: "via National Consumer Helpline",
    epfo_with: "via EPFO grievance portal",
    railmadad_with: "via RailMadad",
    tdr_with: "via IRCTC TDR filing"
  },
  guidance: {
    nch_title: "Consider taking the case further",
    nch_body:
      "NCH convergence partners are expected to respond within about 30 days. This case has passed that window. You could consider filing on e-Jagriti, the consumer commission's e-filing portal. This is a suggestion, not an automatic entitlement.",
    epfo_title: "Time to follow up on your PF claim",
    epfo_body:
      "EPFO guidance suggests following up when a claim stays unresolved. If responses remain unsatisfactory, you may approach the Regional PF Commissioner or raise a public grievance on CPGRAMS. These are suggestions, not fixed rights.",
    railmadad_closure_title: "Response closed as unsatisfactory",
    railmadad_closure_body:
      "RailMadad publishes no fixed response deadline. Because this case was closed unsatisfactorily, you may raise it again or file a public grievance on CPGRAMS. Omitting further railway-specific appeal routes until officially verified.",
    railmadad_stalled_title: "Still no resolution after a long wait",
    railmadad_stalled_body:
      "RailMadad publishes no fixed response deadline, but this case has been open far longer than typical. You may raise it again on RailMadad or file a public grievance on CPGRAMS.",
    tdr_title: "File the TDR before the deadline",
    tdr_body:
      "IRCTC rules require the TDR to be filed online up to four hours before the scheduled departure for confirmed tickets, and up to thirty minutes before for RAC or partially confirmed tickets. File from 'Services > File Ticket Deposit Receipt (TDR)' on irctc.co.in, then track the refund.",
    tdr_expired_title: "TDR window may have passed",
    tdr_expired_body:
      "Per IRCTC rules, refunds for unused confirmed tickets generally require TDR filing before departure deadlines. If you missed it, contact IRCTC customer care with your PNR and transaction details.",
    cpgrams_name: "CPGRAMS public grievance portal"
  },
  casePage: {
    backToDashboard: "All cases",
    notFoundTitle: "Case not found",
    notFoundBody:
      "This case does not exist in this browser. It may have been removed, or the link belongs to another device.",
    evidenceHeading: "Evidence summary",
    evidenceEmpty: "No attachments were added to this case.",
    explanationHeading: "What this status means",
    explanationLoading: "Preparing an explanation…",
    explanationError: "Showing the standard explanation.",
    nextStepHeading: "Suggested next action",
    advisoryBadge: "Advisory",
    officialBadge: "Official deadline",
    sourceLabel: "Source",
    verifiedOn: "Checked against the source on {date}",
    verificationAttempted:
      "Source could not be reached during the build; timing shown as advisory.",
    escalationHeading: "Escalation letter",
    escalationLockedWhy:
      "Escalation becomes available once the trigger for this system applies - for example after the expected response window, or after an unsatisfactory closure.",
    generateLetter: "Prepare escalation letter",
    preparingLetter: "Preparing letter…",
    letterEditableNote:
      "Edit the letter freely. Copy it or download it as a UTF-8 text file. You decide whether to send it.",
    copy: "Copy letter",
    copied: "Copied",
    download: "Download .txt",
    regenerate: "Regenerate letter",
    letterError: "Could not prepare the letter. Please try again.",
    referenceLabel: "Reference",
    expectedResponseLabel: "Expected response time",
    expectedDays: "About {n} days",
    deadlineLabel: "File TDR by",
    urgencyLow: "Low urgency",
    urgencyMedium: "Medium urgency",
    urgencyHigh: "High urgency",
    syntheticNote:
      "Prototype case. No grievance has been filed. References, statuses and responses are simulated."
  },
  privacyMessages: {
    aadhaar: "Looks like an Aadhaar number",
    pan: "Looks like a PAN number",
    otp: "Mentions an OTP or one-time code",
    password: "Contains a password",
    cvv: "Contains a card CVV",
    bank_credential: "Contains banking login credentials",
    card_number: "Looks like a full card number",
    account_number: "Looks like a bank account number"
  },
  escalationSubjects: {
    nch: "Unresolved consumer grievance - case {caseId}",
    epfo: "Pending EPF claim follow-up - case {caseId}",
    railmadad: "Re-examination request for RailMadad complaint {ref}",
    tdr: "TDR refund follow-up for PNR {pnr} (case {caseId})"
  },
  escalationRequests: {
    nch: "a resolution of this complaint, or a clear written explanation if it cannot be resolved at this level",
    epfo: "processing of the pending claim and a written status update",
    railmadad: "re-examination of this complaint and a clear written response",
    tdr: "processing of the TDR refund claim and a written status update"
  },
  footer: {
    builtWith: "Built with Next.js. AI features use OpenAI with deterministic offline fallbacks.",
    sources: "Escalation policy sources"
  }
};

export type Dictionary = typeof en;

export const EN_LOCALE: Locale = "en";
