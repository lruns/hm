package ru.neyvan.hm.impacts;

import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.Surprise;
import ru.neyvan.hm.surprises.Transference;

public class TransferenceImpact extends Impact{
    public TransferenceImpact(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(Surprise surprise) {
        super.start(surprise);
        Transference transference = (Transference) surprise;
        core.getGui().startTransference(transference.getSpeedX(), transference.getSpeedY());
    }

    @Override
    public void end() {
        core.getGui().stopTransference();
    }
}
