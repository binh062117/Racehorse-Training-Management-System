export type Role = 'MANAGER' | 'TRAINER' | 'VET' | 'GROOM' | 'OWNER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';
export type HorseStatus = 'ACTIVE' | 'RESTING' | 'RETIRED';
export type SessionStatus = 'PLANNED' | 'DONE' | 'CANCELLED' | 'MISSED';
export type RaceEntryStatus = 'PENDING' | 'COMPLETED' | 'WITHDRAWN' | 'DID_NOT_START';

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
  stallNumber: string | null;
  trainerId?: string | null;
  trainer?: UserRef | null;
  groomId?: string | null;
  groom?: UserRef | null;
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
  status: RaceEntryStatus;
  prizeWon?: number | null;
  race: {
    id: string;
    name: string;
    date: string;
    venue: string | null;
    prizePool?: number | null;
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
  status: RaceEntryStatus;
  prizeWon?: number | null;
}

export interface RaceDetail extends Race {
  entries: Array<RaceEntry & { horse: Pick<Horse, 'id' | 'name' | 'ownerId'> }>;
}

export interface Vaccination {
  id: string;
  horseId: string;
  horse?: { id: string; name: string };
  careType?: 'VACCINATION' | 'DEWORMING' | 'FARRIER';
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
  /** Target distance (m) for the plan, e.g. 1600. */
  targetDistanceM?: number | null;
  createdAt: string;
  updatedAt: string;
  sessions?: TrainingSession[];
  /** Progress measured by sessions (complete = every session DONE). */
  progress?: PlanProgress;
}

export interface PlanProgress {
  total: number;
  done: number;
  planned: number;
  missed: number;
  cancelled: number;
  pct: number;
  complete: boolean;
  overdue: boolean;
  maxDoneDistanceM: number | null;
  distanceShort: boolean;
}

export interface TrainingSession {
  planId: string | null;
  groomId: string | null;
  groom: { id: string; name: string } | null;
  id: string;
  horseId: string;
  horse: { id: string; name: string; ownerId: string };
  trainerId: string;
  trainer: UserRef;
  scheduledAt: string;
  type: string;
  distanceM?: number | null;
  surface?: string | null;
  status: SessionStatus;
  resultMetric: string | null;
  resultValue: number | null;
  finishTimeSec?: number | null;
  recoveryHeartRate?: number | null;
  muscleResponse?: 'NORMAL' | 'TIGHT' | 'SORE' | null;
  notes: string | null;
  resultRecordedBy?: { id: string; name: string; role: Role } | null;
  resultConfirmed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DailyCareTask =
  | 'FEEDING'
  | 'CLEANING'
  | 'BATHING'
  | 'ICE_SOAK'
  | 'HEALTH_CHECK';

export interface DailyCareLog {
  id: string;
  horseId: string;
  horse: { id: string; name: string; ownerId: string };
  groomId: string;
  groom: UserRef;
  date: string;
  taskType: DailyCareTask;
  completed: boolean;
  completedAt: string | null;
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
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
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
  treatmentPlanId: string | null;
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
  costVnd?: number | null;
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

export interface TrialVideo {
  id: string;
  horseId: string;
  title: string;
  videoUrl: string;
  recordedAt: string;
  notes: string | null;
  duration: string | null;
  createdAt: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  horseId: string;
  horseName: string;
  category: 'PRIZE' | 'FEEDING' | 'FARRIER' | 'VACCINATION' | 'DEWORMING' | 'MEDICAL' | 'BOARDING';
  type: 'INCOME' | 'EXPENSE';
  description: string;
  amount: number;
}

export interface HorseFinanceSummary {
  horseId: string;
  horseName: string;
  ownerId: string;
  ownerName: string;
  prizeMoney: number;
  totalCost: number;
  netBalance: number;
  entryCount: number;
  costs: {
    feeding: number;
    farrier: number;
    preventive: number;
    medical: number;
    boarding: number;
  };
}

export interface FinanceReportResult {
  summary: {
    totalPrizeMoney: number;
    totalCost: number;
    netBalance: number;
    feedingCost: number;
    farrierCost: number;
    preventiveCost: number;
    medicalCost: number;
    boardingCost: number;
  };
  horses: HorseFinanceSummary[];
  transactions: FinanceTransaction[];
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
  unitPrice?: number | null;
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

export interface AuditLog {
  id: string;
  actorId: string | null;
  actor: {
    id: string;
    name: string;
    email: string;
    role: Role | null;
  } | null;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  diff: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditStats {
  totalLogs: number;
  todayLogs: number;
  authEventsToday: number;
  uniqueActorsCount: number;
  topActions: { action: string; count: number }[];
}

export interface FitnessAssessmentItem {
  id: string;
  horseId: string;
  assessedById: string;
  assessedBy?: {
    id: string;
    name: string;
    role: Role | null;
  } | null;
  speedScore: number;
  staminaScore: number;
  conditionScore: number;
  recoveryScore: number;
  moraleScore: number;
  totalScore: number;
  notes: string | null;
  createdAt: string;
}

export interface TrainingMedia {
  id: string;
  horseId: string;
  sessionId: string | null;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  caption: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string; role: Role | null } | null;
  session?: { id: string; type: string; scheduledAt: string } | null;
}

export interface RaceReadiness {
  horseId: string;
  horseName: string;
  ready: boolean;
  reasons: string[];
  fitnessScore: number | null;
  latestPlan: { id: string; goal: string; done: number; total: number; complete: boolean } | null;
}

export interface TaskItem {
  key: string;
  count: number;
  to: string;
  tone: 'bad' | 'warn' | 'info' | 'ok';
}

export interface HorseReport {
  month: string;
  horse: {
    id: string; name: string; breed: string | null; status: HorseStatus; healthStatus: HealthStatus;
    locked: boolean; lockReason: string | null; fitnessScore: number | null;
    owner: { id: string; name: string }; trainer: { id: string; name: string } | null; groom: { id: string; name: string } | null;
  };
  health: {
    exams: { id: string; examDate: string; diagnosis: string; treatment: string | null; healthStatus: HealthStatus | null; vet: { id: string; name: string } }[];
    vets: string[];
    incidents: { id: string; description: string; severity: IncidentSeverity; status: IncidentStatus; createdAt: string }[];
    openIncidents: number;
  };
  feeding: { totalCostVnd: number; totalKg: number; meals: number; uncostedMeals: number; byFeed: { feedType: string; kg: number; costVnd: number; meals: number }[] };
  training: {
    sessions: number; done: number; missed: number; avgFinishTimeSec: number | null;
    plans: { id: string; goal: string; trainer: string; endDate: string | null; targetDistanceM: number | null; progress: PlanProgress }[];
    assessments: { totalScore: number; createdAt: string; assessedBy: { name: string } }[];
  };
  races: { id: string; position: number | null; time: string | null; race: { id: string; name: string; date: string; venue: string | null; distance: number | null } }[];
  readiness: RaceReadiness;
  media: TrainingMedia[];
}

export type StallStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'OUT_OF_SERVICE'
  | 'DISINFECTING'
  | 'QUARANTINED';

export interface StallItem {
  id: string;
  code: string;
  barn: string;
  status: StallStatus;
  pendingStatus?: StallStatus | null;
  pendingNotes?: string | null;
  pendingRequestedById?: string | null;
  pendingRequestedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  horse?: {
    id: string;
    name: string;
    isOtherOwner?: boolean;
    stallNumber?: string | null;
    saddleNumber?: number | null;
    photoUrl?: string | null;
    status: HorseStatus;
    healthStatus: HealthStatus;
    locked: boolean;
    lockReason?: string | null;
    fitnessScore?: number | null;
    breed?: string | null;
    owner?: UserRef;
    trainer?: UserRef | null;
    groom?: UserRef | null;
  } | null;
}
