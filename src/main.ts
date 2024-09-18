import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const PORT = configService.get<string>('port') || 5007;
    const KAFKA_BROKERS = configService.get<string>('kafkaBrokers');
    const GROUP_ID = configService.get<string>('kafkaGroupId');
    const configSwagger = new DocumentBuilder()
        .setTitle('Chat API')
        .setDescription('Api description')
        .setVersion('1.0')
        .addTag('api')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, configSwagger);
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.KAFKA,
        options: {
            client: {
                brokers: [KAFKA_BROKERS]
            },
            consumer: {
                groupId: GROUP_ID
            }
        }
    });
    await app.startAllMicroservices();
    SwaggerModule.setup('api', app, document);
    await app.listen(PORT);
}
bootstrap();
