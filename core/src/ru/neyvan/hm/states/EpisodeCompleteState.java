package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.screens.PlayScreen;

public class EpisodeCompleteState extends State {
    public EpisodeCompleteState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("EpisodeCompleteState", "Begin state with time " + time);
        core.getGui().showEpisodeComplete(time);
    }

    @Override
    public void end() {
        core.nextState(core.getPortalState(), core.portalStateTime);
    }
}
