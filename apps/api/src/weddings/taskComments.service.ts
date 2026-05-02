/**
 * Smart Shaadi — Wedding task comments + attachments
 */

import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  weddingTaskComments,
  weddingTaskAttachments,
  weddingTasks,
  user as userTable,
} from '@smartshaadi/db';
import type { TaskComment, TaskAttachment } from '@smartshaadi/types';
import type {
  CreateTaskCommentInput,
  AddTaskAttachmentInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { getPhotoUrl } from '../storage/service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

async function assertTaskInWedding(weddingId: string, taskId: string): Promise<void> {
  const [r] = await db.select({ id: weddingTasks.id }).from(weddingTasks)
    .where(and(eq(weddingTasks.id, taskId), eq(weddingTasks.weddingId, weddingId))).limit(1);
  if (!r) throw appErr('Task not found', 'NOT_FOUND', 404);
}

export async function listComments(
  weddingId: string,
  userId: string,
  taskId: string,
): Promise<TaskComment[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  await assertTaskInWedding(weddingId, taskId);

  const rows = await db
    .select({
      id: weddingTaskComments.id,
      taskId: weddingTaskComments.taskId,
      authorId: weddingTaskComments.authorId,
      authorName: userTable.name,
      body: weddingTaskComments.body,
      createdAt: weddingTaskComments.createdAt,
    })
    .from(weddingTaskComments)
    .leftJoin(userTable, eq(userTable.id, weddingTaskComments.authorId))
    .where(eq(weddingTaskComments.taskId, taskId))
    .orderBy(asc(weddingTaskComments.createdAt));
  return rows.map((r): TaskComment => ({
    id: r.id, taskId: r.taskId,
    authorId: r.authorId, authorName: r.authorName ?? null,
    body: r.body, createdAt: r.createdAt.toISOString(),
  }));
}

export async function createComment(
  weddingId: string,
  userId: string,
  taskId: string,
  input: CreateTaskCommentInput,
): Promise<TaskComment> {
  await requireRole(weddingId, userId, 'EDITOR');
  await assertTaskInWedding(weddingId, taskId);
  const [row] = await db.insert(weddingTaskComments).values({
    taskId,
    authorId: userId,
    body:     input.body,
  }).returning();
  if (!row) throw appErr('Comment failed', 'COMMENT_CREATE_FAILED', 500);
  await logActivity(weddingId, userId, 'task.comment.create', 'task', taskId);
  return {
    id: row.id, taskId: row.taskId, authorId: row.authorId,
    authorName: null, body: row.body, createdAt: row.createdAt.toISOString(),
  };
}

export async function deleteComment(
  weddingId: string,
  userId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  await assertTaskInWedding(weddingId, taskId);
  const [c] = await db.select().from(weddingTaskComments).where(eq(weddingTaskComments.id, commentId)).limit(1);
  if (!c) throw appErr('Comment not found', 'NOT_FOUND', 404);
  if (c.authorId !== userId) throw appErr('Forbidden', 'FORBIDDEN', 403);
  await db.delete(weddingTaskComments).where(eq(weddingTaskComments.id, commentId));
  await logActivity(weddingId, userId, 'task.comment.delete', 'task', taskId);
}

export async function listAttachments(
  weddingId: string,
  userId: string,
  taskId: string,
): Promise<TaskAttachment[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  await assertTaskInWedding(weddingId, taskId);

  const rows = await db.select().from(weddingTaskAttachments)
    .where(eq(weddingTaskAttachments.taskId, taskId))
    .orderBy(desc(weddingTaskAttachments.createdAt));

  const out: TaskAttachment[] = [];
  for (const r of rows) {
    out.push({
      id: r.id, taskId: r.taskId, r2Key: r.r2Key,
      url: await getPhotoUrl(r.r2Key, 1800).catch(() => null),
      fileName: r.fileName, mimeType: r.mimeType, fileSize: r.fileSize,
      createdAt: r.createdAt.toISOString(),
    });
  }
  return out;
}

export async function addAttachment(
  weddingId: string,
  userId: string,
  taskId: string,
  input: AddTaskAttachmentInput,
): Promise<TaskAttachment> {
  await requireRole(weddingId, userId, 'EDITOR');
  await assertTaskInWedding(weddingId, taskId);
  const [row] = await db.insert(weddingTaskAttachments).values({
    taskId,
    r2Key:    input.r2Key,
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    fileSize: input.fileSize ?? null,
    uploadedBy: userId,
  }).returning();
  if (!row) throw appErr('Add failed', 'ATTACH_CREATE_FAILED', 500);
  await logActivity(weddingId, userId, 'task.attach', 'task', taskId);
  return {
    id: row.id, taskId: row.taskId, r2Key: row.r2Key,
    url: await getPhotoUrl(row.r2Key, 1800).catch(() => null),
    fileName: row.fileName, mimeType: row.mimeType, fileSize: row.fileSize,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function deleteAttachment(
  weddingId: string,
  userId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  await assertTaskInWedding(weddingId, taskId);
  const deleted = await db.delete(weddingTaskAttachments)
    .where(and(eq(weddingTaskAttachments.id, attachmentId), eq(weddingTaskAttachments.taskId, taskId)))
    .returning({ id: weddingTaskAttachments.id });
  if (deleted.length === 0) throw appErr('Attachment not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'task.detach', 'task', taskId);
}
