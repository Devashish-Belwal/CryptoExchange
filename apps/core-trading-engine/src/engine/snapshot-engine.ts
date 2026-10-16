import { EngineSnapshot, MarketSnapshot, R2Config } from "@workspace/shared";
import { GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { EngineState } from "./engine-state";
import { health } from "..";

const SNAPSHOT_PREFIX = "snapshot/";

export class SnapshotEngine {

    private client: S3Client;
    private bucketName: string;


    constructor(private readonly state: EngineState, config: R2Config) {
        this.bucketName = config.bucketName;

        this.client = new S3Client({
            region: "auto",
            endpoint: config.endpoint,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });

    }

    createSnapshot(eventSequenceId: number): EngineSnapshot {
        const marketSnapshots: MarketSnapshot[] = [];

        for (const symbol of this.state.markets.keys()) {
            const orderbook = this.state.orderbooks.get(symbol);
            const position = this.state.positions.get(symbol);

            if (!orderbook || !position) continue;

            marketSnapshots.push({
                symbol,
                takenAt: Date.now(),
                orderbook: orderbook.createSnapshot(),
                positions: position.createSnapshot(),
            });
        }

        return {
            takenAt: Date.now(),
            eventSequenceId,
            assets: Array.from(this.state.assets.values()),
            markets: Array.from(this.state.markets.values()),
            balances: Array.from(this.state.balances.entries()).map(
                ([userId, balance]) => [userId, Array.from(balance.entries())]
            ),
            marketRisk: Array.from(this.state.marketRisk.entries()),
            fundingPayments: this.state.fundingPayments,
            insuranceFunds: Array.from(this.state.insuranceFunds.entries()),
            commissionFunds: Array.from(this.state.commissionFunds.entries()),
            marketSnapshots,
            dailyTickers: Array.from(this.state.dailyTickers.entries()),
        };
    }

    async uploadSnapshot(eventSequenceId: number) {
        const snapshot = this.createSnapshot(eventSequenceId);
        const key = `${SNAPSHOT_PREFIX}Snapshot-${snapshot.takenAt}.json`;

        await this.uploadFile(key, JSON.stringify(snapshot), "application/json");

        return key;
    }

    async restoreSnapshot(): Promise<{ success: boolean; snapshot?: EngineSnapshot }> {
        const allSnapshotFiles = await this.listSnapshotFiles();

        if (allSnapshotFiles.length === 0) {
            return { success: false };
        }

        const latestFile = allSnapshotFiles.reduce((latest, file) => {
            const latestTime = latest.LastModified?.getTime() ?? 0;
            const fileTime = file.LastModified?.getTime() ?? 0;
            return fileTime > latestTime ? file : latest;
        });

        if (!latestFile.Key) {
            return { success: false };
        }

        const snapshot = await this.getFileAsJSON<EngineSnapshot>(latestFile.Key);

        return { success: true, snapshot };
    }

    private async listSnapshotFiles(prefix: string = SNAPSHOT_PREFIX) {
        const allFiles = [];
        let continuationToken: string | undefined = undefined;

        do {
            const command: ListObjectsV2Command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                ContinuationToken: continuationToken
            });

            const response = await this.client.send(command);

            if (response.Contents) {
                allFiles.push(...response.Contents.filter(file => file.Key &&
                    file.Key !== prefix &&
                    file.Size && file.Size > 0
                ));
            }

            continuationToken = response.IsTruncated
                ? response.NextContinuationToken
                : undefined;

        } while (continuationToken);

        return allFiles;
    }

    private async getFile(key: string) {
        const command: GetObjectCommand = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });

        const response = await this.client.send(command);

        if (!response.Body) {
            throw new Error(`File not found or empty: ${key}`);
        }

        const stream = response.Body as Readable;
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }

    private async getFileAsJSON<T = unknown>(key: string): Promise<T> {
        const buffer = await this.getFile(key);
        return JSON.parse(buffer.toString("utf-8")) as T;
    }

    private async uploadFile(
        key: string,
        body: Buffer | Uint8Array | string | Readable,
        contentType?: string
    ) {
        const command: PutObjectCommand = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: body,
            ContentType: contentType ?? "application/octet-stream",
        });

        await this.client.send(command);

        return {
            key,
        };

    }

    async ping() {
        try {
            await this.client.send(
                new HeadBucketCommand({
                    Bucket: this.bucketName
                })
            );

            health.snaphotBucketConnected = true;
        } catch {
            health.snaphotBucketConnected = false;
        }

    }

}