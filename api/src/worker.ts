/// <reference lib="deno.worker" />

import { db } from 'db';
import type { Job, JobType, SessionToken } from './types/job.d.ts';

const sessionCache = new Map<string, SessionToken>();

self.onmessage = function (event: MessageEvent<Job>) {};
