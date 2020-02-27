package ru.neyvan.hm.actors;

import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.screens.EpisodesScreen;

/**
 * Created by AndyGo on 20.11.2017.
 */
public class FieldEpisode extends Button{

    private LevelNumber episodeNumber;
    private TextureRegion lockTexture;
    private float lockWidth;
    private float lockHeight;
    private boolean isOpen;

    public FieldEpisode(final LevelNumber episodeNumber, final EpisodesScreen parent){
        super(new TextureRegionDrawable(HM.game.texture.getEpisodesImage(episodeNumber.getEpisode())));
        lockTexture = HM.game.texture.atlas.findRegion("lock");
        lockHeight = getHeight()*0.3f;
        lockWidth = lockHeight/lockTexture.getRegionHeight() * lockTexture.getRegionWidth();
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

    @Override
    public void draw(Batch batch, float parentAlpha) {
        super.draw(batch, parentAlpha);
        if(!isOpen) batch.draw(lockTexture, getX(Align.center)-lockWidth/2, getY(Align.center)-lockHeight/2,
                lockWidth, lockHeight);
    }

    private void refleshView() {
        isOpen = HM.game.player.isOpened(episodeNumber);
        if(isOpen){
            setColor(1, 1, 1, 1.0f);
        } else {
            setColor(0.4f, 0.4f, 0.4f, 1.0f);
        }
    }
}
