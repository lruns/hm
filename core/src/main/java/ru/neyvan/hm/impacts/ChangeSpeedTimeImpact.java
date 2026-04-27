package ru.neyvan.hm.impacts;

import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.ChangeSpeedTime;
import ru.neyvan.hm.surprises.Surprise;

public class ChangeSpeedTimeImpact extends Impact{
    public ChangeSpeedTimeImpact(PlayScreen core) {
        super(core);
    }

    private ChangeSpeedTime changeSpeedTime;

    @Override
    public void start(Surprise surprise) {
        super.start(surprise);
        changeSpeedTime = (ChangeSpeedTime) surprise;
        core.changeSpeedTime(changeSpeedTime.getMultiplierTime());
        core.getGui().changeSpeedTime(changeSpeedTime.getMultiplierTime() > 1, 1f/changeSpeedTime.getMultiplierTime());
    }

    @Override
    public void update(float delta) {
        super.update(delta / changeSpeedTime.getMultiplierTime());
    }

    @Override
    public void end() {
        core.resetSpeedTime();
        core.getGui().resetSpeedTime();
    }
}
