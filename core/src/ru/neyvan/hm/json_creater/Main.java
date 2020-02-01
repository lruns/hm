package ru.neyvan.hm.json_creater;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonWriter;

import java.util.ArrayList;

/**
 * Created by AndyGo on 08.01.2018.
 */

public class Main extends Game {
    @Override
    public void create() {
        setScreen(new ScreenLevelEditor());

//        Person person = new Person();
//        person.setName("Nate");
//        person.setAge(31);
//        ArrayList numbers = new ArrayList();
//        numbers.add(new PhoneNumber("Home", "206-555-1234"));
//        numbers.add(new PhoneNumber("Work", "425-555-4321"));
//        person.setNumbers(numbers);
//        Json json = new Json();
//        json.setTypeName(null);
//        json.setUsePrototypes(false);
//        json.setIgnoreUnknownFields(true);
//        json.setOutputType(JsonWriter.OutputType.json);
//        FileHandle file = Gdx.files.local("level1.json");
//        file.writeString(json.toJson(person), false);
//        Person f = json.fromJson(Person.class, Gdx.files.local("level1.json"));
//        Gdx.app.log(f.getName(), "sfsdf");

    }

    @Override
    public void render() {
        super.render();
    }
}
