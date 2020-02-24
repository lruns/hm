package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class AllGameComplete extends State {

    public AllGameComplete(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("AllGameComplete", "Begin state with time " + time);
        core.getGui().showAllGameComplete();
    }

    @Override
    public void end() {
        core.exit();
    }
}
