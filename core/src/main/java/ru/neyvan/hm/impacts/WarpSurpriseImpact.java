package ru.neyvan.hm.impacts;

import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.Surprise;
import ru.neyvan.hm.surprises.WarpSurprise;

public class WarpSurpriseImpact extends Impact {

    public WarpSurpriseImpact(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(Surprise surprise) {
        super.start(surprise);
        WarpSurprise warpSurprise = (WarpSurprise) surprise;
        core.getGui().startWarp(warpSurprise.getSpeedWarp());
    }

    @Override
    public void end() {
        core.getGui().stopWarp();
    }
}
