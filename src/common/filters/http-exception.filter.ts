import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  ArgumentsHost,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? exception.getResponse()
      : 'Something went wrong. Please try again later.';

    // Log non-HTTP exceptions with the full stack trace
    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception: ${(exception as Error).message}`,
        (exception as Error).stack,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message: typeof message === 'string' ? message : (message as any).message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
