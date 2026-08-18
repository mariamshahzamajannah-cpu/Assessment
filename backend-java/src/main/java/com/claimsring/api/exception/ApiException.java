package com.claimsring.api.exception;

/** Thrown deliberately by controllers/repositories for expected error conditions
 * (404s, bad params). Equivalent of backend/src/middleware/errorHandler.ts's ApiError. */
public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
