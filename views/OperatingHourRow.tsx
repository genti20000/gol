import React, { useState, useEffect } from 'react';
import { MutationResult } from '../store';
import { DayOperatingHours } from '../types';

interface OperatingHourRowProps {
    oh: DayOperatingHours;
    store: any;
    handleMutation: (updateFn: () => Promise<MutationResult>, errorMsg: string) => Promise<void>;
}

export function OperatingHourRow({ oh, store, handleMutation }: OperatingHourRowProps) {
    const [open, setOpen] = useState(oh.open);
    const [close, setClose] = useState(oh.close);

    useEffect(() => {
        setOpen(oh.open);
        setClose(oh.close);
    }, [oh.open, oh.close]);

    const handleBlur = async () => {
        if (open !== oh.open || close !== oh.close) {
            await handleMutation(() => store.updateOperatingHours(oh.day, { open, close }), 'Failed to update hours.');
        }
    };

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={async () => {
                        await handleMutation(() => store.updateOperatingHours(oh.day, { enabled: !oh.enabled }), 'Failed to update operating hours.');
                    }}
                    title={oh.enabled ? 'Disable day' : 'Enable day'}
                    aria-label={`${oh.enabled ? 'Disable' : 'Enable'} ${dayNames[oh.day]}`}
                    className={`w-12 h-6 rounded-full relative transition-all ${oh.enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${oh.enabled ? 'left-7' : 'left-1'}`}></div>
                </button>
                <span className="text-xs font-bold uppercase tracking-widest text-white w-24">{dayNames[oh.day]}</span>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
                <input
                    type="time"
                    disabled={!oh.enabled}
                    value={open}
                    title="Opening time"
                    aria-label="Opening time"
                    onChange={e => setOpen(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={e => e.key === 'Enter' && handleBlur()}
                    className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white font-mono text-sm disabled:opacity-20"
                />
                <span className="text-zinc-700">to</span>
                <input
                    type="time"
                    disabled={!oh.enabled}
                    value={close}
                    title="Closing time"
                    aria-label="Closing time"
                    onChange={e => setClose(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={e => e.key === 'Enter' && handleBlur()}
                    className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white font-mono text-sm disabled:opacity-20"
                />
            </div>
        </div>
    );
}
