"use client";

import { sampleCases } from "@/lib/samples";

export function SampleSelector({
  selectedSampleId,
  onSelect,
}: {
  selectedSampleId: string;
  onSelect: (sampleId: string) => void;
}) {
  const selectedSample = sampleCases.find((sample) => sample.id === selectedSampleId);

  return (
    <div className="sample-selector">
      <label>
        <span>Try a sample</span>
        <select value={selectedSampleId} onChange={(event) => onSelect(event.target.value)}>
          <option value="">Choose a sample label</option>
          {sampleCases.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.name}
            </option>
          ))}
        </select>
      </label>

      {selectedSample ? (
        <div className="sample-preview-card">
          <img src={selectedSample.imagePath} alt={`${selectedSample.name} sample label`} />
          <div>
            <strong>{selectedSample.name}</strong>
            <p>{selectedSample.description}</p>
            <small>Demo mode uses a repeatable local extraction profile for this fictional sample.</small>
          </div>
        </div>
      ) : (
        <p className="sample-helper">Select a fictional sample label to populate the application fields.</p>
      )}
    </div>
  );
}
