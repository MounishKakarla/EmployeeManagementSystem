package com.employee.exceptions;
public class EmailSendException extends RuntimeException {
    public EmailSendException(String m, Throwable c) { super(m,c); }
}
