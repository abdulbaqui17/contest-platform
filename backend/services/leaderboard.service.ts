import type { Redis } from "ioredis";
import { prisma } from "../../db/prismaClient";
import type { LeaderboardService } from "./interfaces";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  score: number;
  questionsAnswered: number;
}

export class RedisLeaderboardService implements LeaderboardService {
  private readonly LEADERBOARD_KEY_PREFIX = "leaderboard:contest:";
  private readonly METADATA_KEY_PREFIX = "leaderboard:meta:";

  constructor(private readonly redis: Redis) {}

  async updateScore(
    contestId: string,
    userId: string,
    score: number
  ): Promise<void> {
    const leaderboardKey = this.getLeaderboardKey(contestId);
    const metadataKey = this.getMetadataKey(contestId);

    try {
      await this.redis.zadd(leaderboardKey, score, userId);
      await this.redis.hset(metadataKey, "lastUpdate", Date.now().toString());
    } catch (error) {
      throw new Error(
        `Failed to update score for user ${userId} in contest ${contestId}: ${error}`
      );
    }
  }

  async getTopN(contestId: string, n: number): Promise<LeaderboardEntry[]> {
    const leaderboardKey = this.getLeaderboardKey(contestId);

    try {
      const results = await this.redis.zrevrange(
        leaderboardKey,
        0,
        n - 1,
        "WITHSCORES"
      );

      if (results.length === 0) {
        return [];
      }

      const entries: LeaderboardEntry[] = [];
      const userIds: string[] = [];

      for (let i = 0; i < results.length; i += 2) {
        userIds.push(results[i]);
      }

      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u.name]));

      const submissionCounts = await this.getQuestionsAnsweredBatch(
        contestId,
        userIds
      );

      for (let i = 0; i < results.length; i += 2) {
        const userId = results[i];
        const score = parseInt(results[i + 1], 10);
        const rank = Math.floor(i / 2) + 1;

        entries.push({
          rank,
          userId,
          userName: userMap.get(userId) || "Unknown",
          score,
          questionsAnswered: submissionCounts.get(userId) || 0,
        });
      }

      return entries;
    } catch (error) {
      throw new Error(
        `Failed to get top ${n} leaderboard for contest ${contestId}: ${error}`
      );
    }
  }

  async getUserRank(
    contestId: string,
    userId: string
  ): Promise<LeaderboardEntry | null> {
    const leaderboardKey = this.getLeaderboardKey(contestId);

    try {
      const rank = await this.redis.zrevrank(leaderboardKey, userId);

      if (rank === null) {
        return null;
      }

      const score = await this.redis.zscore(leaderboardKey, userId);

      if (score === null) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      });

      if (!user) {
        return null;
      }

      const questionsAnswered = await this.getQuestionsAnswered(
        contestId,
        userId
      );

      return {
        rank: rank + 1,
        userId,
        userName: user.name,
        score: parseInt(score, 10),
        questionsAnswered,
      };
    } catch (error) {
      throw new Error(
        `Failed to get rank for user ${userId} in contest ${contestId}: ${error}`
      );
    }
  }

  async getTotalParticipants(contestId: string): Promise<number> {
    const leaderboardKey = this.getLeaderboardKey(contestId);

    try {
      return await this.redis.zcard(leaderboardKey);
    } catch (error) {
      throw new Error(
        `Failed to get total participants for contest ${contestId}: ${error}`
      );
    }
  }

  async persistLeaderboard(contestId: string): Promise<void> {
    const leaderboardKey = this.getLeaderboardKey(contestId);
    const metadataKey = this.getMetadataKey(contestId);

    try {
      const results = await this.redis.zrevrange(
        leaderboardKey,
        0,
        -1,
        "WITHSCORES"
      );

      if (results.length === 0) {
        return;
      }

      const leaderboardSnapshots: Array<{
        contestId: string;
        userId: string;
        score: number;
        rank: number;
      }> = [];

      for (let i = 0; i < results.length; i += 2) {
        const userId = results[i];
        const score = parseInt(results[i + 1], 10);
        const rank = Math.floor(i / 2) + 1;

        leaderboardSnapshots.push({
          contestId,
          userId,
          score,
          rank,
        });
      }

      await prisma.leaderboardSnapshot.createMany({
        data: leaderboardSnapshots,
        skipDuplicates: true,
      });

      await this.redis.hset(metadataKey, "status", "COMPLETED");
    } catch (error) {
      throw new Error(
        `Failed to persist leaderboard for contest ${contestId}: ${error}`
      );
    }
  }

  private getLeaderboardKey(contestId: string): string {
    return `${this.LEADERBOARD_KEY_PREFIX}${contestId}`;
  }

  private getMetadataKey(contestId: string): string {
    return `${this.METADATA_KEY_PREFIX}${contestId}`;
  }

  private async getQuestionsAnswered(
    contestId: string,
    userId: string
  ): Promise<number> {
    return await prisma.submission.count({
      where: {
        contestId,
        userId,
        isCorrect: true,
      },
    });
  }

  private async getQuestionsAnsweredBatch(
    contestId: string,
    userIds: string[]
  ): Promise<Map<string, number>> {
    const submissions = await prisma.submission.groupBy({
      by: ["userId"],
      where: {
        contestId,
        userId: {
          in: userIds,
        },
        isCorrect: true,
      },
      _count: {
        userId: true,
      },
    });

    return new Map(
      submissions.map((s) => [s.userId, s._count.userId])
    );
  }
}
