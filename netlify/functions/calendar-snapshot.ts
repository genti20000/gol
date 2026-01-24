import { Handler } from '@netlify/functions';
import fs from 'fs';
import path from 'path';

const SNAPSHOT_PATH = '/tmp/lkc_calendar_snapshot.json';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { token } = payload;

    if (!token) {
      return { statusCode: 400, body: 'Token required' };
    }

    // In a serverless environment, /tmp is ephemeral but accessible across invocations 
    // of the same warm instance. For a read-only calendar feed this is often sufficient.
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload));

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Snapshot updated' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};