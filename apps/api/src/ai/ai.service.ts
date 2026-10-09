import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app-exception';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

export interface HorseInsightInput {
  horse: {
    name: string;
    gender: string | null;
    breed: string | null;
    birthDate: Date | null;
    status: string;
    healthStatus: string;
    fitnessScore: number | null;
    locked: boolean;
    lockReason: string | null;
  };
  healthRecords: {
    examDate: Date;
    diagnosis: string;
    treatment: string | null;
  }[];
  incidents: {
    createdAt: Date;
    description: string;
    severity: string;
    status: string;
  }[];
  vaccinations: {
    date: Date;
    vaccineName: string;
    nextDueDate: Date | null;
  }[];
  sessions: {
    scheduledAt: Date;
    type: string;
    status: string;
    resultMetric: string | null;
    resultValue: number | null;
  }[];
}

export interface HorseInsightResult {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons: string[];
  recommendations: string[];
}

const SYSTEM_PROMPT =
  'Bạn là trợ lý thú y cho một trại ngựa đua. Dựa vào dữ liệu hồ sơ ngựa được ' +
  'cung cấp, hãy tóm tắt tình trạng và đánh giá rủi ro chấn thương/sức khỏe. ' +
  'Luôn trả lời bằng tiếng Việt, dưới dạng JSON với đúng các khóa: summary ' +
  '(chuỗi, 2-4 câu), riskLevel ("LOW" | "MEDIUM" | "HIGH"), riskReasons (mảng ' +
  'chuỗi, tối đa 4 mục), recommendations (mảng chuỗi, tối đa 4 mục). Đây chỉ ' +
  'là gợi ý tham khảo, không thay thế chẩn đoán của bác sĩ thú y.';

/**
 * Calls Groq's OpenAI-compatible chat completions API (hosts open-weight
 * models like Llama 3.3) to turn a horse's health/training history into a
 * short risk summary. Raw fetch, same pattern as MailService — no SDK dep.
 */
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger('Ai');
  private apiKey: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GROQ_API_KEY not set — AI insight endpoint will return an error',
      );
      return;
    }
    this.apiKey = apiKey;
  }

  private fmtDate(d: Date | null): string {
    return d ? new Date(d).toISOString().slice(0, 10) : 'không rõ';
  }

  private buildProfile(input: HorseInsightInput): string {
    const lines: string[] = [];
    const h = input.horse;
    lines.push(`Ngựa: ${h.name}`);
    lines.push(
      `Giới tính: ${h.gender ?? 'không rõ'}, Giống: ${h.breed ?? 'không rõ'}, Ngày sinh: ${this.fmtDate(h.birthDate)}`,
    );
    lines.push(
      `Trạng thái: ${h.status}, Tình trạng sức khỏe hiện tại: ${h.healthStatus}, Điểm thể trạng: ${h.fitnessScore ?? 'chưa đánh giá'}`,
    );
    lines.push(
      `Khóa tập luyện: ${h.locked ? `CÓ (lý do: ${h.lockReason ?? 'không rõ'})` : 'không'}`,
    );

    lines.push('\nHồ sơ khám bệnh gần đây:');
    if (input.healthRecords.length === 0) lines.push('- (không có)');
    for (const r of input.healthRecords) {
      lines.push(
        `- ${this.fmtDate(r.examDate)}: chẩn đoán "${r.diagnosis}"${r.treatment ? `, điều trị "${r.treatment}"` : ''}`,
      );
    }

    lines.push('\nSự cố / chấn thương đã ghi nhận:');
    if (input.incidents.length === 0) lines.push('- (không có)');
    for (const i of input.incidents) {
      lines.push(
        `- ${this.fmtDate(i.createdAt)}: mức độ ${i.severity}, trạng thái ${i.status} — "${i.description}"`,
      );
    }

    lines.push('\nTiêm phòng / tẩy giun:');
    if (input.vaccinations.length === 0) lines.push('- (không có)');
    for (const v of input.vaccinations) {
      lines.push(
        `- ${this.fmtDate(v.date)}: ${v.vaccineName}${v.nextDueDate ? ` (hạn kế tiếp ${this.fmtDate(v.nextDueDate)})` : ''}`,
      );
    }

    lines.push('\nLịch sử buổi tập gần đây:');
    if (input.sessions.length === 0) lines.push('- (không có)');
    for (const s of input.sessions) {
      lines.push(
        `- ${this.fmtDate(s.scheduledAt)}: ${s.type}, trạng thái ${s.status}${s.resultMetric ? `, kết quả ${s.resultMetric}=${s.resultValue}` : ''}`,
      );
    }

    return lines.join('\n');
  }

  async analyzeHorse(input: HorseInsightInput): Promise<HorseInsightResult> {
    if (!this.apiKey) {
      throw new AppException(
        'INTERNAL',
        'Tính năng AI chưa được cấu hình (thiếu GROQ_API_KEY)',
      );
    }

    const profile = this.buildProfile(input);
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: profile },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Groq request failed (${res.status}): ${body}`);
      throw new AppException(
        'INTERNAL',
        'Không thể tạo phân tích AI lúc này, vui lòng thử lại sau',
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppException('INTERNAL', 'AI không trả về kết quả hợp lệ');
    }

    let parsed: Partial<HorseInsightResult>;
    try {
      parsed = JSON.parse(content) as Partial<HorseInsightResult>;
    } catch {
      throw new AppException(
        'INTERNAL',
        'AI trả về dữ liệu không đúng định dạng',
      );
    }

    const riskLevel: HorseInsightResult['riskLevel'] =
      parsed.riskLevel === 'HIGH' ||
      parsed.riskLevel === 'MEDIUM' ||
      parsed.riskLevel === 'LOW'
        ? parsed.riskLevel
        : 'LOW';

    return {
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : 'Không có tóm tắt.',
      riskLevel,
      riskReasons: Array.isArray(parsed.riskReasons)
        ? parsed.riskReasons.filter((x): x is string => typeof x === 'string')
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter(
            (x): x is string => typeof x === 'string',
          )
        : [],
    };
  }
}
