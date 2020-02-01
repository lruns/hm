package ru.neyvan.hm.managers;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.assets.AssetManager;
import com.badlogic.gdx.assets.loaders.ParticleEffectLoader;
import com.badlogic.gdx.assets.loaders.SkinLoader;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.BitmapFont;
import com.badlogic.gdx.graphics.g2d.NinePatch;
import com.badlogic.gdx.graphics.g2d.ParticleEffect;
import com.badlogic.gdx.graphics.g2d.TextureAtlas;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.utils.NinePatchDrawable;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 30.06.2017.
 */
public class TextureManager implements Manager{

    public TextureAtlas atlas;
    public Skin skin;
    public BitmapFont numberFont;
    private Texture menuBackground;
    private Texture textureFont;
    private Texture[] episodesImage;

    @Override
    public void init() {
        HM.game.manager.load("game_atlas.atlas", TextureAtlas.class);

        ParticleEffectLoader.ParticleEffectParameter pep = new ParticleEffectLoader.ParticleEffectParameter();
        pep.atlasFile = "game_atlas.atlas";
        HM.game.manager.load("particles/stream_energy.p", ParticleEffect.class, pep);
        HM.game.manager.load("particles/good_shine.p", ParticleEffect.class, pep);
        HM.game.manager.load("particles/bad_shine.p", ParticleEffect.class, pep);

        SkinLoader.SkinParameter params = new SkinLoader.SkinParameter("style/hm_skin.atlas");
        HM.game.manager.load("style/hm_skin.json", Skin.class, params);
        HM.game.manager.finishLoading();

        atlas = HM.game.manager.get("game_atlas.atlas");
        skin = HM.game.manager.get("style/hm_skin.json");

        for (Texture t : atlas.getTextures()) {
            t.setFilter(Texture.TextureFilter.Linear, Texture.TextureFilter.Linear);
        }

        textureFont = new Texture(Gdx.files.internal("style/hm_numbers.png"), true);
        textureFont.setFilter(Texture.TextureFilter.MipMapLinearNearest, Texture.TextureFilter.Linear);
        numberFont = new BitmapFont(Gdx.files.internal("style/hm_numbers.fnt"), new TextureRegion(textureFont), false);
    }
    public Texture getMenuBackground(int i){
        if (menuBackground != null) menuBackground.dispose();
        menuBackground = new Texture("backdrops/backdrop"+i+".jpg");
        return menuBackground;
    }
    public void setEpisodesImages(int maxCount){
        episodesImage = new Texture[maxCount];
        for (int i=0; i<maxCount; i++){
            episodesImage[i] = new Texture("minEpisodes/episode"+i+".jpg");
        }
    }
    public Texture getEpisodesImage(int i){
        return episodesImage[i];
    }
    public void disposeEpisodesImages(){
        for (int i=0; i<episodesImage.length; i++){
            episodesImage[i].dispose();
        }
        episodesImage = null;
    }
    public NinePatchDrawable getNinePatchDrawable(String name) {
        return new NinePatchDrawable(new NinePatch(new Texture(name+".9.png"), 10, 10, 10, 10));
    }

    @Override
    public void dispose() {
        textureFont.dispose();
    }
}
