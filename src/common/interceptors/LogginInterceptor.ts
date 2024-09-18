import { Injectable, NestInterceptor, ExecutionContext, CallHandler, LoggerService, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService;

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const now = Date.now();

        switch (context.getType()) {
            case 'http':
                return this.logHttp(context, next, now);

            case 'rpc':
                return this.logRpc(context, next, now);

            default:
                return next.handle();
        }
    }

    private logHttp(context: ExecutionContext, next: CallHandler, now: number): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const { method, url } = request;

        this.logger.log(`Incoming request: ${method} ${url} - ${Date.now() - now}ms`);

        return next.handle().pipe(
            tap(() => {
                const { statusCode } = response;
                this.logger.log(`Outgoing response: ${method} ${url} ${statusCode} - ${Date.now() - now}ms`);
            })
        );
    }

    private logRpc(context: ExecutionContext, next: CallHandler, now: number): Observable<any> {
        const handlerName = context.getHandler().name;

        this.logger.log(`Incoming RPC request: ${handlerName} - ${Date.now() - now}ms`);

        return next.handle().pipe(
            tap(() => {
                this.logger.log(`Outgoing RPC response: ${handlerName} - ${Date.now() - now}ms`);
            })
        );
    }
}
