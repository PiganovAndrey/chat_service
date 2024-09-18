import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    ForbiddenException,
    Inject,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { ClientKafka } from '@nestjs/microservices';
  import { Request } from 'express';
  import { lastValueFrom } from 'rxjs';
  import ITokenData from './../common/interfaces/token.data';
  
  @Injectable()
  export class SessionGuard implements CanActivate {
    constructor(
      private readonly reflector: Reflector,
      @Inject('AUTH_SERVICE') private readonly clientKafka: ClientKafka, // Инъекция клиента Kafka
    ) {}
  
    async onModuleInit() {
      this.clientKafka.subscribeToResponseOf('auth.session'); // Подписка на топик для ответа
      await this.clientKafka.connect(); // Подключение клиента
    }
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      if(context.getType() === 'rpc') {
        return true;
      }
      const request = context.switchToHttp().getRequest<Request>();
      const authorizationHeader = request.headers.authorization;
      if (!authorizationHeader) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }
  
      return await this.validateToken(authorizationHeader, context, request);
    }
  
    private async validateToken(authorizationHeader: string, context: ExecutionContext, request: Request): Promise<boolean> {
      try {
        // Отправка сообщения в auth_service через Kafka
        const parts = authorizationHeader.split(' ');
        const response = await lastValueFrom(
          this.clientKafka.send<ITokenData>('auth.session', { authorization: {accessToken: parts[1], refreshToken: parts[2]} }),
        );
  
        if (!response) {
          throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
  
        request['sessionData'] = response;
  
        const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
        if (
          requiredRoles &&
          !this.hasRequiredRole(response.role, requiredRoles) &&
          !requiredRoles.includes('all')
        ) {
          throw new ForbiddenException('You do not have the required role to access this resource');
        }
  
        return true;
      } catch (error) {
        console.error(error);
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }
    }
  
    private hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
      return requiredRoles.includes(userRole);
    }
  }
  