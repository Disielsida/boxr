import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorPayload {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  errors?: unknown[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = isHttp ? exception.getResponse() : null;

    const payload: ErrorPayload = {
      statusCode: status,
      message: extractMessage(errorResponse) ?? defaultMessage(status),
      error: extractError(errorResponse) ?? statusToErrorName(status),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const errors = extractErrors(errorResponse);
    if (errors) payload.errors = errors;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(payload);
  }
}

function extractMessage(res: unknown): string | string[] | null {
  if (typeof res === 'string') return res;
  if (res && typeof res === 'object' && 'message' in res) {
    const msg = (res as { message: unknown }).message;
    if (typeof msg === 'string' || Array.isArray(msg)) return msg;
  }
  return null;
}

function extractErrors(res: unknown): unknown[] | null {
  if (res && typeof res === 'object' && 'errors' in res) {
    const errs = (res as { errors: unknown }).errors;
    if (Array.isArray(errs)) return errs;
  }
  return null;
}

function extractError(res: unknown): string | null {
  if (res && typeof res === 'object' && 'error' in res) {
    const err = (res as { error: unknown }).error;
    if (typeof err === 'string') return err;
  }
  return null;
}

function statusToErrorName(status: number): string {
  return HttpStatus[status] ? String(HttpStatus[status]) : 'Error';
}

function defaultMessage(status: number): string {
  return status >= 500 ? 'Внутренняя ошибка сервера' : 'Ошибка запроса';
}
