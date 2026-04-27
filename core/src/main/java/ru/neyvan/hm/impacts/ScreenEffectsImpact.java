package ru.neyvan.hm.impacts;

import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.ScreenEffects;
import ru.neyvan.hm.surprises.Surprise;

public class ScreenEffectsImpact extends Impact{
    public ScreenEffectsImpact(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(Surprise surprise) {
        super.start(surprise);
        ScreenEffects screenEffects = (ScreenEffects) surprise;
        core.getGui().startScreenEffect(screenEffects.getType());
    }

    @Override
    public void end() {
        core.getGui().stopScreenEffect();
    }
}
