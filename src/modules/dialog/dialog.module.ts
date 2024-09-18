import { Module } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { DialogController } from './dialog.controller';
import { DatabaseModule } from '../database/database.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();
const KAFKA_BROKERS = configService.get<string>('KAFKA_BROKERS');

@Module({
    imports: [
        DatabaseModule,
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
                        groupId: 'auth-consumer-14',
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
    controllers: [DialogController],
    providers: [DialogService]
})
export class DialogModule {}
