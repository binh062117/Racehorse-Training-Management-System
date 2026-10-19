import { api } from './api';
import type { Medication, TreatmentPlan } from './types';

export interface CreateTreatmentPlanInput {
  description: string;
  startDate: string;
  endDate?: string;
}

export interface CreateMedicationInput {
  name: string;
  dosage?: string;
  startDate?: string;
  endDate?: string;
}

export const listTreatmentPlans = (recordId: string) =>
  api.get<TreatmentPlan[]>(`/health-records/${recordId}/treatment-plans`).then((r) => r.data);

export const createTreatmentPlan = (recordId: string, input: CreateTreatmentPlanInput) =>
  api.post<TreatmentPlan>(`/health-records/${recordId}/treatment-plans`, input).then((r) => r.data);

export const listMedications = (planId: string) =>
  api.get<Medication[]>(`/treatment-plans/${planId}/medications`).then((r) => r.data);

export const createMedication = (planId: string, input: CreateMedicationInput) =>
  api.post<Medication>(`/treatment-plans/${planId}/medications`, input).then((r) => r.data);
