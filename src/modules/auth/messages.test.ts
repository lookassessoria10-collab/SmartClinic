import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, authErrorMessage } from "./messages";

describe("authErrorMessage", () => {
  it.each([
    [{ code: "email_address_not_authorized", status: 400 }, AUTH_MESSAGES.emailSendFailed],
    [{ code: "unexpected_failure", status: 500, message: "Error sending confirmation email" }, AUTH_MESSAGES.emailSendFailed],
    [{ code: "over_email_send_rate_limit", status: 429 }, AUTH_MESSAGES.tooManyAttempts],
    [{ code: "invalid_credentials", status: 400 }, AUTH_MESSAGES.invalidCredentials],
    [{ code: "otp_expired", status: 403 }, AUTH_MESSAGES.linkInvalid],
    [{ code: "unexpected_failure", status: 500, message: "Database error" }, AUTH_MESSAGES.unexpected],
  ])("%j → mensagem certa", (error, message) => expect(authErrorMessage(error)).toBe(message));
});
