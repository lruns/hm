package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.screens.EpisodesScreen;

/**
 * Created by AndyGo on 20.11.2017.
 */
public class FieldEpisode extends Button{

    private LevelNumber episodeNumber;
    public FieldEpisode(final LevelNumber episodeNumber, final EpisodesScreen parent){
        super(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("title")));
        this.episodeNumber = episodeNumber;
        addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                refleshView();
                parent.setClickedEpisode(episodeNumber);
                parent.changeEpisodeField();
            }
        });
        refleshView();
    }

    private void refleshView() {
        if(HM.game.player.isOpened(episodeNumber)){
            setColor(0f, 1f/(episodeNumber.getEpisode()+0.1f), 0f, 1.0f);
        } else {
            setColor(0, 0, 1, 1.0f);
        }
    }
}
