import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
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
    controllers: [MessageController],
    providers: [MessageService]
})
export class MessageModule {}
