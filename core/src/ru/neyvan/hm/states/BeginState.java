package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class BeginState extends State{

    public BeginState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("BeginState", "Begin state with time " + time);
        core.getGame().firstNumber();
        core.getGui().showStart(time);
        core.getGui().appear(time);


    }

    @Override
    public void end() {
        core.getGui().updateDisplay();
        core.nextState(core.getWaitState(), core.getGame().getTimeWait());
    }
}