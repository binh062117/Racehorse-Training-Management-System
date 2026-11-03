export type Role = 'MANAGER' | 'TRAINER' | 'VET' | 'GROOM' | 'OWNER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';
export type HorseStatus = 'ACTIVE' | 'RESTING' | 'RETIRED';
export type SessionStatus = 'PLANNED' | 'DONE' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
}

export type HealthStatus = 'FIT' | 'MONITORING' | 'QUARANTINED' | 'INJURED';
export type HorseGender = 'MALE' | 'FEMALE';

export interface Horse {
  id: string;
  name: string;
  gender: HorseGender | null;
  breed: string | null;
  birthDate: string | null;
  ownerId: string;
  owner: UserRef;
  status: HorseStatus;
  healthStatus: HealthStatus;
  fitnessScore: number | null;
  saddleNumber: number | null;
  sireId: string | null;
  damId: string | null;
  locked: boolean;
  lockReason: string | null;
  /** The HIGH incident that set the current lock, if any. */
  lockIncidentId?: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PedigreeNode {
  id: string;
  name: string;
  fitnessScore: number | null;
  sire: PedigreeNode | null;
  dam: PedigreeNode | null;
}

export interface HorseRaceEntry {
  id: string;
  horseId: string;
  position: number | null;
  time: string | null;
  race: {
    id: string;
    name: string;
    date: string;
    venue: string | null;
  };
}

export interface Race {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  distance: number | null;
  surface: string | null;
  prizePool: number | null;
}

export interface RaceEntry {
  id: string;
  raceId: string;
  horseId: string;
  position: number | null;
  time: string | null;
}

export interface RaceDetail extends Race {
  entries: Array<RaceEntry & { horse: Pick<Horse, 'id' | 'name' | 'ownerId'> }>;
}

export interface Vaccination {
  id: string;
  horseId: string;
  horse?: { id: string; name: string };
  careType?: 'VACCINATION' | 'DEWORMING';
  vaccineName: string;
  date: string;
  nextDueDate: string | null;
  createdAt: string;
}


export interface TrainingPlan {
  id: string;
  horseId: string;
  horse: { id: string; name: string; breed?: string | null; ownerId: string };
  trainerId: string;
  trainer: UserRef;
  goal: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  sessions?: TrainingSession[];
}

export interface TrainingSession {
  id: string;
  horseId: string;
  horse: { id: string; name: string; ownerId: string };
  trainerId: string;
  trainer: UserRef;
  scheduledAt: string;
  type: string;
  status: SessionStatus;
  resultMetric: string | null;
  resultValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthRecord {
  id: string;
  horseId: string;
  horse: { id: string; name: string; ownerId: string };
  vetId: string;
  vet: UserRef;
  examDate: string;
  diagnosis: string;
  treatment: string | null;
  /** The exam's conclusion — a FIT one is what an unlock needs. */
  healthStatus: HealthStatus | null;
  attachmentPath: string | null;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface TreatmentPlan {
  id: string;
  healthRecordId: string;
  description: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  id: string;
  healthRecordId: string;
  treatmentPlanId: string;
  name: string;
  dosage: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface FeedingRecord {
  id: string;
  horseId: string;
  recordedById: string;
  recordedBy: UserRef;
  date: string;
  feedType: string;
  quantityKg: number;
  notes: string | null;
  supplyItemId?: string | null;
  supplyItem?: { id: string; name: string; unit: string } | null;
  createdAt: string;
}

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface Incident {
  id: string;
  horseId: string;
  horse: { id: string; name: string; ownerId: string; locked?: boolean; lockIncidentId?: string | null };
  healthRecord?: { id: string; examDate: string; diagnosis: string; healthStatus: HealthStatus | null } | null;
  reportedById: string;
  reportedBy: UserRef;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  healthRecordId: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface OtpRequiredResponse {
  otpRequired: true;
  email: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface HorseLockEvent {
  id: string;
  horseId: string;
  locked: boolean;
  reason: string;
  createdAt: string;
  actor: { id: string; name: string; role: Role | null } | null;
  healthRecord: { id: string; examDate: string; diagnosis: string; healthStatus: HealthStatus | null } | null;
  incidentReport: { id: string; description: string; severity: IncidentSeverity; status: IncidentStatus } | null;
}

export type SupplyCategory = 'FEED' | 'MEDICINE' | 'EQUIPMENT';
export type SupplyRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SupplyItem {
  id: string;
  name: string;
  category: SupplyCategory;
  unit: string;
  quantity: number;
  minQuantity: number;
  notes: string | null;
  low: boolean;
  pendingRequests: number;
  pendingQuantity: number;
  updatedAt: string;
}

export interface SupplyRequest {
  id: string;
  itemId: string;
  item: { id: string; name: string; unit: string; category: SupplyCategory; quantity: number };
  quantity: number;
  note: string | null;
  status: SupplyRequestStatus;
  requestedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** A page plus per-filter counts, as returned by GET /incidents and GET /users. */
export type CountedPage<T> = Paginated<T> & { counts: Record<string, number> };
