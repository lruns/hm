package ru.neyvan.hm.impacts;

import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.Surprise;

public class HelpSurpriseImpact extends Impact{

    private boolean isTurnedOn = false;

    public HelpSurpriseImpact(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(Surprise surprise) {
        super.start(surprise);
        isTurnedOn = true;
    }

    @Override
    public void end() {
        isTurnedOn = false;
    }

    public boolean isTurnedOn() {
        return isTurnedOn;
    }
}
