package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class FullFreezingState extends State {


    // ДОДЕЛАТЬ В СЛЕДУЮЩИХ ВЕРСИЯХ

    public FullFreezingState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("FullFreezingState", "Begin state with time " + time);
    }

    @Override
    public void end() {
        core.nextState(core.getChangeState(), core.getGame().getTimeChange());
    }
}
