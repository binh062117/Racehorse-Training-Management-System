import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { PedigreeNode } from '../../lib/types';
import { ErrorText } from '../ErrorText';

interface PedigreeTreeProps {
  horseId: string;
}

export function PedigreeTree({ horseId }: PedigreeTreeProps) {
  const [tree, setTree] = useState<PedigreeNode | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<PedigreeNode>(`/horses/${horseId}/pedigree`)
      .then((r) => {
        if (!active) return;
        setTree(r.data);
        setErr(null);
      })
      .catch((e) => {
        if (!active) return;
        setErr(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [horseId]);

  if (loading) return <p className="muted">Đang tải phả hệ…</p>;
  if (err) return <ErrorText err={err} />;
  if (!tree) return <p className="muted">Chưa có thông tin phả hệ cho ngựa này.</p>;

  const sire = tree.sire;
  const dam = tree.dam;
  const sireSire = sire?.sire;
  const sireDam = sire?.dam;
  const damSire = dam?.sire;
  const damDam = dam?.dam;

  return (
    <div className="card ped-tree">
      <div>
        <div className="ped-gen-label">Đời 1 — Ngựa chính</div>
        <div className="ped-card self">
          <div className="ped-name">{tree.name}</div>
          <div className="ped-role">
            Bản thân {tree.fitnessScore != null ? `· Thể trạng: ${tree.fitnessScore}/100` : ''}
          </div>
        </div>
      </div>

      <div>
        <div className="ped-gen-label">Đời 2 — Cha / Mẹ (Sire / Dam)</div>
        <div className="ped-row ped-row-2">
          {sire ? (
            <Link to={`/horses/${sire.id}`} className="ped-card" style={{ textDecoration: 'none' }}>
              <div className="ped-name" style={{ color: 'var(--brand-blue)' }}>♂ {sire.name}</div>
              <div className="ped-role">Cha (Sire) {sire.fitnessScore != null ? `· Thể trạng: ${sire.fitnessScore}` : ''}</div>
            </Link>
          ) : (
            <div className="ped-card empty">Chưa ghi nhận ngựa Cha (Sire)</div>
          )}

          {dam ? (
            <Link to={`/horses/${dam.id}`} className="ped-card" style={{ textDecoration: 'none' }}>
              <div className="ped-name" style={{ color: 'var(--brand-blue)' }}>♀ {dam.name}</div>
              <div className="ped-role">Mẹ (Dam) {dam.fitnessScore != null ? `· Thể trạng: ${dam.fitnessScore}` : ''}</div>
            </Link>
          ) : (
            <div className="ped-card empty">Chưa ghi nhận ngựa Mẹ (Dam)</div>
          )}
        </div>
      </div>

      <div>
        <div className="ped-gen-label">Đời 3 — Ông / Bà nội ngoại (Grandparents)</div>
        <div className="ped-row ped-row-4">
          {sireSire ? (
            <Link to={`/horses/${sireSire.id}`} className="ped-card" style={{ textDecoration: 'none' }}>
              <div className="ped-name" style={{ color: 'var(--brand-blue)', fontSize: '12.5px' }}>♂ {sireSire.name}</div>
              <div className="ped-role">Ông nội</div>
            </Link>
          ) : (
            <div className="ped-card empty">Ông nội: —</div>
          )}

          {sireDam ? (
            <Link to={`/horses/${sireDam.id}`} className="ped-card" style={{ textDecoration: 'none' }}>
              <div className="ped-name" style={{ color: 'var(--brand-blue)', fontSize: '12.5px' }}>♀ {sireDam.name}</div>
              <div className="ped-role">Bà nội</div>
            </Link>
          ) : (
            <div className="ped-card empty">Bà nội: —</div>
          )}

          {damSire ? (
            <Link to={`/horses/${damSire.id}`} className="ped-card" style={{ textDecoration: 'none' }}>
              <div className="ped-name" style={{ color: 'var(--brand-blue)', fontSize: '12.5px' }}>♂ {damSire.name}</div>
              <div className="ped-role">Ông ngoại</div>
            </Link>
          ) : (
            <div className="ped-card empty">Ông ngoại: —</div>
          )}

          {damDam ? (
            <Link to={`/horses/${damDam.id}`} className="ped-card" style={{ textDecoration: 'none' }}>
              <div className="ped-name" style={{ color: 'var(--brand-blue)', fontSize: '12.5px' }}>♀ {damDam.name}</div>
              <div className="ped-role">Bà ngoại</div>
            </Link>
          ) : (
            <div className="ped-card empty">Bà ngoại: —</div>
          )}
        </div>
      </div>
    </div>
  );
}
