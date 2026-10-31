package app.gatemate.common;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Long retryAfterSeconds;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(HttpStatus status, String code, String message, Long retryAfterSeconds) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public Long retryAfterSeconds() { return retryAfterSeconds; }

    public static ApiException notFound(String what) { return new ApiException(HttpStatus.NOT_FOUND, "not_found", what + " not found."); }
    public static ApiException forbidden() { return new ApiException(HttpStatus.FORBIDDEN, "forbidden", "You do not have access to this."); }
    public static ApiException badRequest(String code, String msg) { return new ApiException(HttpStatus.BAD_REQUEST, code, msg); }
    public static ApiException tooMany(long retryAfter) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited", "Too many attempts. Please wait a moment.", retryAfter);
    }
}
