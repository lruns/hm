package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class WinState extends State {
    public WinState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        core.getGui().showWin();
        Gdx.app.debug("WinState", "Begin state with time " + time);
    }

    @Override
    public void end() {
        core.nextState(core.getPortalState(), core.winStateTime);
    }
}
