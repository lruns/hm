package ru.neyvan.hm.impacts;

import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.Rotation;
import ru.neyvan.hm.surprises.Surprise;

public class RotationImpact extends Impact{
    public RotationImpact(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(Surprise surprise) {
        super.start(surprise);
        Rotation rotation = (Rotation) surprise;
        core.getGui().startRotate(rotation.getSpeed(), rotation.isOneCircle(), rotation.getMaxTime());
    }

    @Override
    public void end() {
        core.getGui().stopRotate();
    }
}
