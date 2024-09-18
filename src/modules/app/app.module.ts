import { Module } from '@nestjs/common';
import { MessageModule } from '../message/message.module';
import { DialogModule } from '../dialog/dialog.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '../../config/winston.config';
import configuration from 'src/config/configuration';
import { SessionGuard } from 'src/guards/session.guard';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { LoggingInterceptor } from 'src/common/interceptors/LogginInterceptor';
import { ClientsModule, Transport } from '@nestjs/microservices';

const configService = new ConfigService();
const KAFKA_BROKERS = configService.get<string>('KAFKA_BROKERS');

@Module({
    imports: [
        DatabaseModule,
        MessageModule,
        DialogModule,
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration]
        }),
        WinstonModule.forRoot({
            transports: winstonConfig.transports,
            format: winstonConfig.format,
            level: winstonConfig.level
        }),
        ClientsModule.register([
            {
                name: 'IMAGE_SERVICE',
                transport: Transport.KAFKA,
                options: {
                    client: {
                        clientId: 'image-service',
                        brokers: [KAFKA_BROKERS]
                    },
                    consumer: {
                        groupId: 'image-consumer'
                    }
                }
            },
            {
                name: 'USER_MOBILE_SERVICE',
                transport: Transport.KAFKA,
                options: {
                    client: {
                        clientId: 'user_mobile-service',
                        brokers: [KAFKA_BROKERS]
                    },
                    consumer: {
                        groupId: 'user_mobile-consumer'
                    }
                }
            },
            {
                name: 'AUTH_SERVICE',
                transport: Transport.KAFKA,
                options: {
                    client: {
                        clientId: 'auth-service',
                        brokers: [KAFKA_BROKERS]
                    },
                    consumer: {
                        groupId: 'auth-consumer',
                        retry: {
                            retries: 5,
                            restartOnFailure: async () => {
                                console.error('Consumer crashed, restarting...');
                                return true;
                            }
                        }
                    }
                }
            }
        ])
    ],
    providers: [
        Reflector,
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }
    ]
})
export class AppModule {}
